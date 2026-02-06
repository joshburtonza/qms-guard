import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessFileRequest {
  filePath: string;       // Path in edith-uploads bucket: {tenant_id}/{filename}
  mimeType: string;
  fileName: string;
  conversationId?: string;
  extractionMode?: 'text' | 'structured' | 'summary';
}

interface ProcessedFile {
  fileName: string;
  mimeType: string;
  extractedText: string;
  metadata: {
    pageCount?: number;
    rowCount?: number;
    columnCount?: number;
    sheetNames?: string[];
    wordCount: number;
    truncated: boolean;
  };
  tables?: Array<{ headers: string[]; rows: string[][] }>;
}

// ==================== FILE PARSERS ====================

async function parseCSV(content: string): Promise<ProcessedFile> {
  const lines = content.trim().split('\n');
  const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) || [];
  const rows = lines.slice(1).map(line => 
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  );

  const textSummary = `CSV File: ${headers.length} columns, ${rows.length} rows\n\nHeaders: ${headers.join(', ')}\n\nFirst 50 rows:\n${
    rows.slice(0, 50).map((row, i) => 
      `Row ${i + 1}: ${row.map((cell, j) => `${headers[j] || `col${j}`}="${cell}"`).join(', ')}`
    ).join('\n')
  }`;

  return {
    fileName: '',
    mimeType: 'text/csv',
    extractedText: textSummary,
    metadata: {
      rowCount: rows.length,
      columnCount: headers.length,
      wordCount: content.split(/\s+/).length,
      truncated: rows.length > 50,
    },
    tables: [{ headers, rows: rows.slice(0, 200) }],
  };
}

async function parseExcel(fileBuffer: ArrayBuffer): Promise<ProcessedFile> {
  // Use SheetJS from CDN for Deno
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
  
  const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
  const sheetNames = workbook.SheetNames;
  
  let fullText = `Excel File: ${sheetNames.length} sheet(s)\n\n`;
  const allTables: Array<{ headers: string[]; rows: string[][] }> = [];

  for (const sheetName of sheetNames.slice(0, 5)) { // Max 5 sheets
    const sheet = workbook.Sheets[sheetName];
    const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (jsonData.length === 0) continue;

    const headers = jsonData[0].map(String);
    const rows = jsonData.slice(1, 201).map(row => row.map(String)); // Max 200 rows per sheet

    fullText += `--- Sheet: ${sheetName} (${jsonData.length - 1} rows, ${headers.length} columns) ---\n`;
    fullText += `Headers: ${headers.join(', ')}\n\n`;
    fullText += rows.slice(0, 50).map((row, i) => 
      `Row ${i + 1}: ${row.map((cell, j) => `${headers[j] || `col${j}`}="${cell}"`).join(', ')}`
    ).join('\n');
    fullText += '\n\n';

    allTables.push({ headers, rows });
  }

  return {
    fileName: '',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extractedText: fullText,
    metadata: {
      sheetNames,
      rowCount: allTables.reduce((sum, t) => sum + t.rows.length, 0),
      columnCount: allTables[0]?.headers.length || 0,
      wordCount: fullText.split(/\s+/).length,
      truncated: false,
    },
    tables: allTables,
  };
}

async function parsePDF(fileBuffer: ArrayBuffer): Promise<ProcessedFile> {
  // PDF text extraction using pdf-parse compatible approach for Deno
  // For Deno edge functions, we use a lightweight approach
  const uint8 = new Uint8Array(fileBuffer);
  
  // Extract text from PDF using stream extraction
  // This is a simplified extractor - for production, consider pdf.js
  let extractedText = '';
  let pageCount = 0;
  
  // Convert to string to find text streams
  const pdfString = new TextDecoder('latin1').decode(uint8);
  
  // Count pages
  const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
  pageCount = pageMatches?.length || 1;
  
  // Extract text between stream/endstream markers
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  const textParts: string[] = [];
  
  while ((match = streamRegex.exec(pdfString)) !== null) {
    const streamContent = match[1];
    // Look for text show operators: Tj, TJ, '
    const textMatches = streamContent.match(/\((.*?)\)\s*Tj/g);
    if (textMatches) {
      for (const tm of textMatches) {
        const text = tm.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
        if (text.trim()) textParts.push(text);
      }
    }
    // Also try TJ array operator
    const tjArrayMatches = streamContent.match(/\[(.*?)\]\s*TJ/g);
    if (tjArrayMatches) {
      for (const tjm of tjArrayMatches) {
        const innerTexts = tjm.match(/\((.*?)\)/g);
        if (innerTexts) {
          for (const it of innerTexts) {
            const text = it.replace(/^\(/, '').replace(/\)$/, '');
            if (text.trim()) textParts.push(text);
          }
        }
      }
    }
  }

  extractedText = textParts.join(' ').trim();
  
  // If extraction failed (common with compressed PDFs), provide a note
  if (!extractedText || extractedText.length < 20) {
    extractedText = `[PDF contains ${pageCount} page(s). Text extraction found limited readable text - the PDF may use compressed streams or contain primarily images. The file has been stored and can be referenced by NC number.]`;
  }

  // Truncate if too long (max ~8000 tokens worth)
  const maxChars = 32000;
  const truncated = extractedText.length > maxChars;
  if (truncated) {
    extractedText = extractedText.substring(0, maxChars) + '\n\n[...truncated, showing first ~8000 tokens]';
  }

  return {
    fileName: '',
    mimeType: 'application/pdf',
    extractedText: `PDF Document (${pageCount} pages):\n\n${extractedText}`,
    metadata: {
      pageCount,
      wordCount: extractedText.split(/\s+/).length,
      truncated,
    },
  };
}

async function parseWord(fileBuffer: ArrayBuffer): Promise<ProcessedFile> {
  // DOCX is a ZIP containing XML
  // Use Deno's built-in ZIP handling via fflate
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  
  const uint8 = new Uint8Array(fileBuffer);
  const unzipped = unzipSync(uint8);
  
  // Get document.xml content
  const documentXml = unzipped['word/document.xml'];
  if (!documentXml) {
    return {
      fileName: '',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extractedText: '[Could not extract text from Word document]',
      metadata: { wordCount: 0, truncated: false },
    };
  }

  const xmlText = new TextDecoder().decode(documentXml);
  
  // Extract text from XML - get all <w:t> elements
  const paragraphs: string[] = [];
  let currentParagraph = '';
  
  // Simple XML text extraction
  const lines = xmlText.split(/<w:p[ >]/);
  for (const line of lines) {
    const texts = line.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (texts) {
      currentParagraph = texts
        .map(t => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
        .join('');
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
      }
    }
  }

  const extractedText = paragraphs.join('\n\n');
  const maxChars = 32000;
  const truncated = extractedText.length > maxChars;

  return {
    fileName: '',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extractedText: truncated ? extractedText.substring(0, maxChars) + '\n\n[...truncated]' : extractedText,
    metadata: {
      pageCount: Math.ceil(paragraphs.length / 30), // rough estimate
      wordCount: extractedText.split(/\s+/).length,
      truncated,
    },
  };
}

async function parseImage(fileBuffer: ArrayBuffer, mimeType: string): Promise<ProcessedFile> {
  // For images, we return info for the AI to interpret
  return {
    fileName: '',
    mimeType,
    extractedText: `[Image file - ${(fileBuffer.byteLength / 1024).toFixed(1)}KB ${mimeType}. Image has been uploaded and stored. To analyze image content, the AI provider would need vision capabilities.]`,
    metadata: {
      wordCount: 0,
      truncated: false,
    },
  };
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }
    const supabaseUser = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("*, tenants(id, name)")
      .eq("id", user.id)
      .single();

    const request: ProcessFileRequest = await req.json();
    const { filePath, mimeType, fileName, conversationId } = request;

    console.log(`Processing file: ${fileName} (${mimeType}) at ${filePath}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseUser.storage
      .from("edith-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'File not found'}`);
    }

    const fileBuffer = await fileData.arrayBuffer();
    let result: ProcessedFile;

    // Parse based on MIME type
    switch (mimeType) {
      case 'text/csv': {
        const textContent = new TextDecoder().decode(fileBuffer);
        result = await parseCSV(textContent);
        break;
      }
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        result = await parseExcel(fileBuffer);
        break;
      }
      case 'application/pdf': {
        result = await parsePDF(fileBuffer);
        break;
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        result = await parseWord(fileBuffer);
        break;
      }
      case 'image/png':
      case 'image/jpeg':
      case 'image/webp': {
        result = await parseImage(fileBuffer, mimeType);
        break;
      }
      default: {
        // Try as plain text
        try {
          const textContent = new TextDecoder().decode(fileBuffer);
          result = {
            fileName,
            mimeType,
            extractedText: textContent.substring(0, 32000),
            metadata: {
              wordCount: textContent.split(/\s+/).length,
              truncated: textContent.length > 32000,
            },
          };
        } catch {
          throw new Error(`Unsupported file type: ${mimeType}`);
        }
      }
    }

    result.fileName = fileName;

    // Log usage
    try {
      await supabaseUser.from("edith_usage_log").insert({
        tenant_id: profile?.tenant_id,
        user_id: user.id,
        conversation_id: conversationId,
        provider: 'system',
        model: 'file-parser',
        input_tokens: 0,
        output_tokens: result.metadata.wordCount,
        tool_calls_count: 0,
        latency_ms: 0,
        estimated_cost_usd: 0,
        interaction_type: 'import',
      });
    } catch (logError) {
      console.error("Failed to log file processing:", logError);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("File processing error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to process file",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
