/**
 * KnowledgeService.gs
 * Unified knowledge management for AI prompts
 *
 * Provides consistent Drive document fetching, caching, and token management
 * across all AI-powered features.
 *
 * Architecture:
 * - Fetch documents from Google Drive (single or folder)
 * - Cache documents using Apps Script Cache Service (30-minute TTL)
 * - Estimate token usage and warn at capacity thresholds
 * - Return structured knowledge objects with metadata
 * - Fail fast with actionable errors when knowledge configured but inaccessible
 *
 * Design Principles:
 * - No artificial character limits (trust Gemini's 1M token capacity)
 * - No fallback behavior (explicit configuration = explicit intent)
 * - Token transparency (utilization metrics in metadata)
 * - Soft warnings at 50% and 90% of model capacity
 */

// ============================================================================
// UTILITY FUNCTIONS (Private)
// ============================================================================

/**
 * Extract document ID from Google Drive URL or return as-is if already an ID
 *
 * Supported formats:
 * - Document ID: "1abc123xyz"
 * - Full URL: "https://docs.google.com/document/d/1abc123xyz/edit"
 * - Short URL: "https://docs.google.com/document/d/1abc123xyz"
 *
 * @private
 * @param {string} docIdOrUrl - Document ID or URL
 * @return {string|null} Document ID or null if invalid
 */
function extractDocumentId_(docIdOrUrl) {
  if (!docIdOrUrl) return null;

  // Already an ID (no slashes)
  if (docIdOrUrl.indexOf('/') === -1) {
    return docIdOrUrl;
  }

  // Extract from URL: https://docs.google.com/document/d/{ID}/edit
  const match = docIdOrUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Extract folder ID from Google Drive URL or return as-is if already an ID
 *
 * Supported formats:
 * - Folder ID: "1abc123xyz"
 * - Full URL: "https://drive.google.com/drive/folders/1abc123xyz"
 * - Short URL: "https://drive.google.com/drive/folders/1abc123xyz?usp=sharing"
 *
 * @private
 * @param {string} folderIdOrUrl - Folder ID or URL
 * @return {string|null} Folder ID or null if invalid
 */
function extractFolderId_(folderIdOrUrl) {
  if (!folderIdOrUrl) return null;

  // Already an ID (no slashes)
  if (folderIdOrUrl.indexOf('/') === -1) {
    return folderIdOrUrl;
  }

  // Extract from URL: https://drive.google.com/drive/folders/{ID}
  const match = folderIdOrUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Estimate token count from character count using chars/4 heuristic
 *
 * This is a rough approximation:
 * - English text: ~4 chars per token
 * - Code: ~3.5 chars per token
 * - Special characters: varies
 *
 * For accurate token counting, use the Gemini API's tokenization endpoint,
 * but that requires an additional API call. This heuristic is sufficient
 * for warning thresholds.
 *
 * @private
 * @param {string} text - Text to estimate tokens for
 * @return {number} Estimated token count
 */
function estimateTokens_(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Generate cache key for a document
 *
 * @private
 * @param {string} docId - Document ID
 * @return {string} Cache key
 */
function generateCacheKey_(docId) {
  return 'KNOWLEDGE_DOC_' + docId;
}

/**
 * Log token warnings if approaching model capacity
 *
 * Warning thresholds:
 * - 50-90%: Soft warning (approaching limit)
 * - >90%: Critical warning (may fail)
 *
 * @private
 * @param {Object} metadata - Knowledge metadata object
 */
function logTokenWarnings_(metadata) {
  const cfg = getConfig_();

  // Check if warnings are enabled (default: true)
  if (cfg.KNOWLEDGE_LOG_SIZE_WARNINGS === 'false') {
    return;
  }

  const estimatedTokens = metadata.estimatedTokens;
  const modelLimit = metadata.modelLimit;
  const utilizationPercent = (estimatedTokens / modelLimit * 100);

  // Soft warning at 50% capacity
  if (utilizationPercent > 50 && utilizationPercent <= 90) {
    Logger.log(
      '⚠️  Knowledge size warning: ~' + estimatedTokens + ' tokens ' +
      '(' + utilizationPercent.toFixed(1) + '% of model capacity). ' +
      'Approaching model limit of ' + modelLimit + ' tokens.'
    );
  }

  // Critical warning at 90% capacity
  if (utilizationPercent > 90) {
    Logger.log(
      '🚨 Knowledge size critical: ~' + estimatedTokens + ' tokens ' +
      '(' + utilizationPercent.toFixed(1) + '% of model capacity). ' +
      'Request may fail. Strongly recommend reducing knowledge documents ' +
      'by lowering KNOWLEDGE_MAX_DOCS or removing some documents.'
    );
  }
}

// ============================================================================
// CORE FUNCTIONS: Single Document
// ============================================================================

/**
 * Fetch a single Google Drive document
 *
 * Behavior:
 * - If docIdOrUrl is null/empty: returns { configured: false }
 * - If docIdOrUrl is invalid URL: throws error
 * - If document inaccessible: throws error with actionable message
 * - If successful: returns knowledge with metadata
 *
 * Caching:
 * - Results cached for KNOWLEDGE_CACHE_DURATION_MINUTES (default: 30)
 * - Cache can be bypassed with options.skipCache
 * - Cache key: KNOWLEDGE_DOC_{docId}
 *
 * @param {string} docIdOrUrl - Document ID or full Google Drive URL
 * @param {Object} options - Configuration options
 * @param {string} options.propertyName - Configuration property name (for error messages)
 * @param {boolean} options.skipCache - Skip cache lookup (default: false)
 * @return {Object} { configured: boolean, knowledge: string|null, metadata: Object|null }
 *
 * @example
 * // Not configured
 * const result = fetchDocument_(null, { propertyName: 'LABEL_KNOWLEDGE_DOC_URL' });
 * // Returns: { configured: false, knowledge: null, metadata: null }
 *
 * @example
 * // Valid document
 * const result = fetchDocument_('1abc123xyz', { propertyName: 'LABEL_KNOWLEDGE_DOC_URL' });
 * // Returns: {
 * //   configured: true,
 * //   knowledge: "document content...",
 * //   metadata: { chars: 1234, estimatedTokens: 309, source: {...} }
 * // }
 */
function fetchDocument_(docIdOrUrl, options) {
  options = options || {};

  // Not configured - return early
  if (!docIdOrUrl) {
    return {
      configured: false,
      knowledge: null,
      metadata: null
    };
  }

  const docId = extractDocumentId_(docIdOrUrl);

  if (!docId) {
    throw new Error(
      'Invalid knowledge document URL: "' + docIdOrUrl + '".\n' +
      'Expected format: https://docs.google.com/document/d/DOCUMENT_ID/edit\n' +
      'Configuration property: ' + (options.propertyName || 'unknown')
    );
  }

  // Check cache first (unless skipCache is true)
  if (!options.skipCache) {
    const cacheKey = generateCacheKey_(docId);
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);

    if (cached) {
      const cfg = getConfig_();
      if (cfg.KNOWLEDGE_DEBUG === 'true') {
        Logger.log('Using cached knowledge document: ' + docId);
      }

      // Parse cached JSON
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Cache corrupted, fall through to fetch
        Logger.log('Cache corrupted for ' + docId + ', fetching fresh');
      }
    }
  }

  // Fetch from Drive
  let content;
  let docName;

  try {
    const doc = DocumentApp.openById(docId);
    docName = doc.getName();
    content = doc.getBody().getText();
  } catch (e) {
    throw new Error(
      'Failed to fetch knowledge document (ID: ' + docId + ').\n' +
      'Document may not exist or you may lack permission.\n' +
      'Configuration property: ' + (options.propertyName || 'unknown') + '\n' +
      'To proceed without knowledge, remove this property.\n' +
      'Original error: ' + e.message
    );
  }

  // Build result
  const result = {
    configured: true,
    knowledge: content,
    metadata: {
      chars: content.length,
      estimatedTokens: estimateTokens_(content),
      source: {
        name: docName,
        url: 'https://docs.google.com/document/d/' + docId + '/edit'
      }
    }
  };

  // Cache for configured duration (default: 30 minutes)
  const cfg = getConfig_();
  const cacheDurationMinutes = parseInt(cfg.KNOWLEDGE_CACHE_DURATION_MINUTES || '30');
  const cacheDurationSeconds = cacheDurationMinutes * 60;
  const cacheKey = generateCacheKey_(docId);
  const cache = CacheService.getScriptCache();

  try {
    cache.put(cacheKey, JSON.stringify(result), cacheDurationSeconds);

    if (cfg.KNOWLEDGE_DEBUG === 'true') {
      Logger.log('Cached knowledge document: ' + docId + ' for ' + cacheDurationMinutes + ' minutes');
    }
  } catch (e) {
    // Cache storage failed (content too large for Apps Script cache?), continue without caching
    Logger.log('Failed to cache document ' + docId + ': ' + e.message + '. Continuing without cache.');
  }

  return result;
}

// ============================================================================
// CORE FUNCTIONS: Folder (Multiple Documents)
// ============================================================================

/**
 * Fetch multiple documents from a Google Drive folder
 *
 * Behavior:
 * - If folderIdOrUrl is null/empty: returns { configured: false }
 * - If folderIdOrUrl is invalid URL: throws error
 * - If folder inaccessible: throws error with actionable message
 * - If folder has no accessible documents: throws error
 * - If successful: returns combined knowledge with aggregated metadata
 *
 * Document Processing:
 * - Only fetches Google Docs (MimeType.GOOGLE_DOCS)
 * - Respects options.maxDocs limit (default: 10)
 * - Each document prefixed with "=== Document Name ===" header
 * - Documents separated by blank lines
 * - Individual document errors logged but don't stop processing
 *
 * Caching:
 * - Individual documents benefit from fetchDocument_() caching
 * - No additional folder-level caching
 *
 * @param {string} folderIdOrUrl - Folder ID or full Google Drive URL
 * @param {Object} options - Configuration options
 * @param {number} options.maxDocs - Maximum number of documents to fetch (default: 10)
 * @param {string} options.propertyName - Configuration property name (for error messages)
 * @param {boolean} options.skipCache - Skip cache lookup for individual documents (default: false)
 * @return {Object} { configured: boolean, knowledge: string|null, metadata: Object|null }
 *
 * @example
 * // Not configured
 * const result = fetchFolder_(null, { propertyName: 'LABEL_KNOWLEDGE_FOLDER_URL' });
 * // Returns: { configured: false, knowledge: null, metadata: null }
 *
 * @example
 * // Valid folder with 3 documents
 * const result = fetchFolder_('1xyz789abc', {
 *   propertyName: 'LABEL_KNOWLEDGE_FOLDER_URL',
 *   maxDocs: 5
 * });
 * // Returns: {
 * //   configured: true,
 * //   knowledge: "=== Doc1 ===\ncontent...\n\n=== Doc2 ===\ncontent...",
 * //   metadata: {
 * //     docCount: 3,
 * //     totalChars: 5678,
 * //     estimatedTokens: 1420,
 * //     modelLimit: 1048576,
 * //     utilizationPercent: "0.1%",
 * //     sources: [...]
 * //   }
 * // }
 */
function fetchFolder_(folderIdOrUrl, options) {
  options = options || {};

  // Not configured - return early
  if (!folderIdOrUrl) {
    return {
      configured: false,
      knowledge: null,
      metadata: null
    };
  }

  const folderId = extractFolderId_(folderIdOrUrl);

  if (!folderId) {
    throw new Error(
      'Invalid knowledge folder URL: "' + folderIdOrUrl + '".\n' +
      'Expected format: https://drive.google.com/drive/folders/FOLDER_ID\n' +
      'Configuration property: ' + (options.propertyName || 'unknown')
    );
  }

  // Get folder
  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error(
      'Failed to access knowledge folder (ID: ' + folderId + ').\n' +
      'Folder may not exist or you may lack permission.\n' +
      'Configuration property: ' + (options.propertyName || 'unknown') + '\n' +
      'To proceed without knowledge, remove this property.\n' +
      'Original error: ' + e.message
    );
  }

  // Fetch documents from folder
  const maxDocs = options.maxDocs || 10;
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  const sources = [];
  const knowledgeParts = [];
  let totalChars = 0;
  let docCount = 0;

  while (files.hasNext() && docCount < maxDocs) {
    const file = files.next();
    const docId = file.getId();

    try {
      // Fetch individual document (benefits from caching)
      const docResult = fetchDocument_(docId, {
        propertyName: options.propertyName,
        skipCache: options.skipCache
      });

      if (docResult.configured) {
        knowledgeParts.push('=== ' + docResult.metadata.source.name + ' ===');
        knowledgeParts.push(docResult.knowledge);
        knowledgeParts.push('');  // Blank line separator

        sources.push({
          name: docResult.metadata.source.name,
          chars: docResult.metadata.chars,
          url: docResult.metadata.source.url
        });

        totalChars += docResult.metadata.chars;
        docCount++;
      }
    } catch (e) {
      // Log error but continue with other documents
      Logger.log('Failed to fetch document ' + docId + ' from folder: ' + e.message);
    }
  }

  if (docCount === 0) {
    throw new Error(
      'No accessible documents found in knowledge folder (ID: ' + folderId + ').\n' +
      'Folder may be empty or you may lack permission to read documents.\n' +
      'Configuration property: ' + (options.propertyName || 'unknown')
    );
  }

  const combinedKnowledge = knowledgeParts.join('\n');
  const estimatedTokens = estimateTokens_(combinedKnowledge);
  const modelLimit = 1048576;  // 1M tokens for Gemini 2.5

  // Build result
  return {
    configured: true,
    knowledge: combinedKnowledge,
    metadata: {
      docCount: docCount,
      totalChars: totalChars,
      estimatedTokens: estimatedTokens,
      modelLimit: modelLimit,
      utilizationPercent: (estimatedTokens / modelLimit * 100).toFixed(1) + '%',
      sources: sources
    }
  };
}

// ============================================================================
// HIGH-LEVEL FUNCTIONS: Feature-Specific Knowledge Fetchers
// ============================================================================

/**
 * Fetch knowledge for email labeling
 *
 * Combines optional single document + optional folder knowledge.
 * If both configured, document content appears first, then folder contents.
 *
 * Configuration Properties:
 * - LABEL_KNOWLEDGE_DOC_URL: Single document with core labeling rules
 * - LABEL_KNOWLEDGE_FOLDER_URL: Folder with additional context documents
 * - LABEL_KNOWLEDGE_MAX_DOCS: Max documents from folder (default: 5)
 *
 * @param {Object} config - Configuration object
 * @param {string} config.docUrl - LABEL_KNOWLEDGE_DOC_URL value
 * @param {string} config.folderUrl - LABEL_KNOWLEDGE_FOLDER_URL value
 * @param {number} config.maxDocs - Maximum documents to fetch from folder (default: 5)
 * @return {Object} { configured: boolean, knowledge: string|null, metadata: Object|null }
 *
 * @example
 * // Nothing configured
 * const knowledge = fetchLabelingKnowledge_({
 *   docUrl: null,
 *   folderUrl: null
 * });
 * // Returns: { configured: false, knowledge: null, metadata: null }
 *
 * @example
 * // Document only
 * const knowledge = fetchLabelingKnowledge_({
 *   docUrl: 'https://docs.google.com/document/d/abc123/edit',
 *   folderUrl: null,
 *   maxDocs: 5
 * });
 * // Returns: { configured: true, knowledge: "...", metadata: {...} }
 *
 * @example
 * // Document + folder
 * const knowledge = fetchLabelingKnowledge_({
 *   docUrl: 'https://docs.google.com/document/d/abc123/edit',
 *   folderUrl: 'https://drive.google.com/drive/folders/xyz789',
 *   maxDocs: 5
 * });
 * // Returns: {
 * //   configured: true,
 * //   knowledge: "doc content\n\n=== Folder Doc 1 ===\n...",
 * //   metadata: { docCount: 6, totalChars: ..., utilizationPercent: "2.5%", ... }
 * // }
 */
function fetchLabelingKnowledge_(config) {
  config = config || {};

  const docUrl = config.docUrl;
  const folderUrl = config.folderUrl;
  const maxDocs = config.maxDocs || 5;

  // Nothing configured
  if (!docUrl && !folderUrl) {
    return {
      configured: false,
      knowledge: null,
      metadata: null
    };
  }

  const parts = [];
  const sources = [];
  let totalChars = 0;
  let totalDocs = 0;

  // Fetch single document if configured
  if (docUrl) {
    const docResult = fetchDocument_(docUrl, {
      propertyName: 'LABEL_KNOWLEDGE_DOC_URL'
    });

    if (docResult.configured) {
      parts.push(docResult.knowledge);
      sources.push(docResult.metadata.source);
      totalChars += docResult.metadata.chars;
      totalDocs++;
    }
  }

  // Fetch folder if configured
  if (folderUrl) {
    const folderResult = fetchFolder_(folderUrl, {
      propertyName: 'LABEL_KNOWLEDGE_FOLDER_URL',
      maxDocs: maxDocs
    });

    if (folderResult.configured) {
      parts.push(folderResult.knowledge);
      sources.push(...folderResult.metadata.sources);
      totalChars += folderResult.metadata.totalChars;
      totalDocs += folderResult.metadata.docCount;
    }
  }

  const combinedKnowledge = parts.join('\n\n');
  const estimatedTokens = estimateTokens_(combinedKnowledge);
  const modelLimit = 1048576;

  const result = {
    configured: true,
    knowledge: combinedKnowledge,
    metadata: {
      docCount: totalDocs,
      totalChars: totalChars,
      estimatedTokens: estimatedTokens,
      modelLimit: modelLimit,
      utilizationPercent: (estimatedTokens / modelLimit * 100).toFixed(1) + '%',
      sources: sources
    }
  };

  // Log token warnings if approaching capacity
  logTokenWarnings_(result.metadata);

  return result;
}

/**
 * Fetch knowledge for reply drafting
 *
 * Combines optional instructions document + optional context folder.
 * If both configured, instructions appear first, then context documents.
 *
 * Configuration Properties:
 * - REPLY_DRAFTER_INSTRUCTIONS_URL: Document with drafting style/guidelines
 * - REPLY_DRAFTER_CONTEXT_FOLDER_URL: Folder with context documents
 * - REPLY_DRAFTER_CONTEXT_MAX_DOCS: Max documents from folder (default: 5)
 *
 * @param {Object} config - Configuration object
 * @param {string} config.instructionsUrl - REPLY_DRAFTER_INSTRUCTIONS_URL value
 * @param {string} config.contextFolderUrl - REPLY_DRAFTER_CONTEXT_FOLDER_URL value
 * @param {number} config.maxDocs - Maximum documents to fetch from folder (default: 5)
 * @return {Object} { configured: boolean, knowledge: string|null, metadata: Object|null }
 *
 * @example
 * // Nothing configured (basic drafting mode)
 * const knowledge = fetchReplyKnowledge_({
 *   instructionsUrl: null,
 *   contextFolderUrl: null
 * });
 * // Returns: { configured: false, knowledge: null, metadata: null }
 *
 * @example
 * // Instructions only
 * const knowledge = fetchReplyKnowledge_({
 *   instructionsUrl: 'https://docs.google.com/document/d/abc123/edit',
 *   contextFolderUrl: null,
 *   maxDocs: 5
 * });
 * // Returns: { configured: true, knowledge: "my writing style...", metadata: {...} }
 *
 * @example
 * // Instructions + context
 * const knowledge = fetchReplyKnowledge_({
 *   instructionsUrl: 'https://docs.google.com/document/d/abc123/edit',
 *   contextFolderUrl: 'https://drive.google.com/drive/folders/xyz789',
 *   maxDocs: 5
 * });
 * // Returns: {
 * //   configured: true,
 * //   knowledge: "instructions\n\n=== Context Doc 1 ===\n...",
 * //   metadata: { docCount: 4, utilizationPercent: "1.2%", ... }
 * // }
 */
function fetchReplyKnowledge_(config) {
  config = config || {};

  const instructionsUrl = config.instructionsUrl;
  const contextFolderUrl = config.contextFolderUrl;
  const maxDocs = config.maxDocs || 5;

  // Nothing configured
  if (!instructionsUrl && !contextFolderUrl) {
    return {
      configured: false,
      knowledge: null,
      metadata: null
    };
  }

  const parts = [];
  const sources = [];
  let totalChars = 0;
  let totalDocs = 0;

  // Fetch instructions if configured
  if (instructionsUrl) {
    const instructionsResult = fetchDocument_(instructionsUrl, {
      propertyName: 'REPLY_DRAFTER_INSTRUCTIONS_URL'
    });

    if (instructionsResult.configured) {
      parts.push(instructionsResult.knowledge);
      sources.push(instructionsResult.metadata.source);
      totalChars += instructionsResult.metadata.chars;
      totalDocs++;
    }
  }

  // Fetch context folder if configured
  if (contextFolderUrl) {
    const contextResult = fetchFolder_(contextFolderUrl, {
      propertyName: 'REPLY_DRAFTER_CONTEXT_FOLDER_URL',
      maxDocs: maxDocs
    });

    if (contextResult.configured) {
      parts.push(contextResult.knowledge);
      sources.push(...contextResult.metadata.sources);
      totalChars += contextResult.metadata.totalChars;
      totalDocs += contextResult.metadata.docCount;
    }
  }

  const combinedKnowledge = parts.join('\n\n');
  const estimatedTokens = estimateTokens_(combinedKnowledge);
  const modelLimit = 1048576;

  const result = {
    configured: true,
    knowledge: combinedKnowledge,
    metadata: {
      docCount: totalDocs,
      totalChars: totalChars,
      estimatedTokens: estimatedTokens,
      modelLimit: modelLimit,
      utilizationPercent: (estimatedTokens / modelLimit * 100).toFixed(1) + '%',
      sources: sources
    }
  };

  // Log token warnings if approaching capacity
  logTokenWarnings_(result.metadata);

  return result;
}
