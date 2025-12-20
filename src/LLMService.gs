/**
 * Parse retry delay from Google API error message
 * Returns delay in seconds, or null if not found
 */
function parseRetryDelay_(errorMessage) {
  if (!errorMessage) return null;

  // Parse "Please retry in X.XXXs" or "retry after Xs"
  const match = errorMessage.match(/retry\s+(?:in|after)\s+(\d+\.?\d*)\s*s/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Retry wrapper with exponential backoff
 * Parses Google's retry delay from error messages and respects them
 *
 * @param {Function} apiCallFn - Function that makes the API call
 * @param {number} maxRetries - Maximum retry attempts (from config)
 * @param {string} operationName - Name for logging (e.g., "categorize", "summarize")
 * @returns {*} Result from apiCallFn
 * @throws {Error} If all retries exhausted
 */
function retryWithBackoff_(apiCallFn, maxRetries, operationName) {
  const cfg = getConfig_();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return apiCallFn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        if (cfg.DEBUG) {
          Logger.log(`${operationName}: Max retries (${maxRetries}) exhausted`);
        }
        throw error;
      }

      const errorMessage = error.message || error.toString();

      // Only retry on quota/rate limit errors
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('RESOURCE_EXHAUSTED') ||
                          errorMessage.includes('429');

      if (!isQuotaError) {
        // Not a quota error - don't retry
        throw error;
      }

      // Parse retry delay from Google's error message
      let delaySeconds = parseRetryDelay_(errorMessage);

      // If no delay specified, use exponential backoff: 2^attempt seconds
      if (!delaySeconds) {
        delaySeconds = Math.pow(2, attempt);
      }

      // Add small buffer (10%) to Google's suggested delay
      const bufferSeconds = delaySeconds * 0.1;
      const totalDelay = delaySeconds + bufferSeconds;
      const delayMs = Math.ceil(totalDelay * 1000);

      Logger.log(`${operationName}: Quota exceeded. Retry ${attempt + 1}/${maxRetries} after ${totalDelay.toFixed(2)}s`);

      // Sleep before retry
      Utilities.sleep(delayMs);
    }
  }

  // Should never reach here, but throw last error just in case
  throw lastError;
}

function categorizeBatch_(prompt, model, projectId, location, apiKey) {
  const cfg = getConfig_();

  // Wrap API call in retry logic
  return retryWithBackoff_(function() {
    // Prompt is already built by PromptBuilder - just make the API call
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }]}] };

    if (cfg.DEBUG) {
      console.log(JSON.stringify({
        promptSent: {
          promptLength: prompt.length,
          model: model,
          promptPreview: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : '')
        }
      }, null, 2));
    }

    // If API key is present, use Generative Language API (AI Studio) endpoint; else use Vertex OAuth.
    const useApiKey = !!apiKey;
    const url = useApiKey
      ? ('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey))
      : ('https://' + location + '-aiplatform.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/locations/' + encodeURIComponent(location) + '/publishers/google/models/' + encodeURIComponent(model) + ':generateContent');
    const headers = useApiKey ? {} : { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    const opts = {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const parseOut = function(txt) {
      try {
        const first = extractFirstJson_(txt);
        return first && Array.isArray(first.emails) ? first.emails : null;
      } catch (e) { return null; }
    };

    let res = UrlFetchApp.fetch(url, opts);
    let json = {};
    try { json = JSON.parse(res.getContentText()); } catch (e) { json = {}; }

    // Check for errors and provide actionable error messages
    if (json.error && json.error.message) {
      const errorMsg = json.error.message;
      const responseCode = res.getResponseCode();

      // Token limit errors (don't retry these)
      if (errorMsg.includes('token limit') || errorMsg.includes('context length') || errorMsg.includes('exceeded maximum')) {
        throw new Error(
          'Gemini API token limit exceeded. ' +
          'Your knowledge documents and emails exceeded the model\'s 1M token capacity. ' +
          'Try reducing LABEL_KNOWLEDGE_MAX_DOCS or processing fewer emails. ' +
          'Original error: ' + errorMsg
        );
      }

      // Quota/rate limit errors (will be retried by retryWithBackoff_)
      if (responseCode === 429 || errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'Google API quota exceeded. You have hit the rate limits or quota for the Gemini API. ' +
          'Check your quota and increase limits at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas ' +
          'Original error: ' + errorMsg
        );
      }
    }

    if (cfg.DEBUG) {
      console.log(JSON.stringify({ requestChars: prompt.length, httpStatus: res.getResponseCode(), apiMode: useApiKey ? 'apiKey' : 'vertex', raw: json }, null, 2));
    }
    let txt = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text) || '';
    let out = parseOut(txt);

    if (!out) {
      const model2 = model; // optionally escalate
      const url2 = useApiKey
        ? ('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model2) + ':generateContent?key=' + encodeURIComponent(apiKey))
        : ('https://' + location + '-aiplatform.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/locations/' + encodeURIComponent(location) + '/publishers/google/models/' + encodeURIComponent(model2) + ':generateContent');
      res = UrlFetchApp.fetch(url2, opts);
      try { json = JSON.parse(res.getContentText()); } catch (e) { json = {}; }
      if (cfg.DEBUG) {
        console.log(JSON.stringify({ retry: true, httpStatus: res.getResponseCode(), raw: json }, null, 2));
      }
      txt = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text) || '';
      out = parseOut(txt);
    }

    if (!out) {
      if (cfg.DEBUG) {
        console.log(JSON.stringify({ parsedEmails: null, reason: 'malformed-json-or-empty' }, null, 2));
      }
      // Return null to signal parsing failure - caller handles fallback logic
      return null;
    }
    return out;
  }, cfg.API_MAX_RETRIES, 'categorizeBatch');
}

function extractFirstJson_(txt) {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  return JSON.parse(m[0]);
}

/**
 * Phase 3: AI Summarization - Web App Service Extension
 * Added for Interactive Web App Agent
 */

/**
 * Generate consolidated summary using AI service with pre-built prompt
 * Follows "The Economist's World in Brief" style with bold formatting
 *
 * NOTE: Caller is responsible for building prompt with knowledge injection.
 * Use buildSummaryPrompt_(emails, knowledge, config) before calling this function.
 *
 * Returns: { success: boolean, summary: string, error?: string }
 */
function generateConsolidatedSummary_(prompt, config) {
  try {
    if (!prompt || typeof prompt !== 'string') {
      return {
        success: false,
        error: 'No prompt provided for summarization'
      };
    }

    // Get configuration
    const cfg = getConfig_();

    // Wrap API call in retry logic
    const result = retryWithBackoff_(function() {
      const model = cfg.MODEL_PRIMARY;
      const apiKey = cfg.GEMINI_API_KEY;
      const projectId = cfg.PROJECT_ID;
      const location = cfg.LOCATION;

      // Prepare API request using existing patterns
      const payload = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      };

      // Debug logging following existing pattern
      if (cfg.DEBUG) {
        Logger.log(`LLMService.generateConsolidatedSummary_: Prompt length: ${prompt.length} chars`);
      }

      // Choose API endpoint based on available credentials (following existing pattern)
      const useApiKey = !!apiKey;
      const url = useApiKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
        : `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

      const headers = useApiKey ? {} : { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      // Make API call
      const response = UrlFetchApp.fetch(url, options);
      const responseText = response.getContentText();
      let json = {};

      try {
        json = JSON.parse(responseText);
      } catch (parseError) {
        Logger.log('LLM API JSON parse error: ' + parseError.toString());
        throw new Error('Failed to parse AI service response');
      }

      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        Logger.log('LLM API error: ' + responseText);

        // Handle quota/rate limit errors (will be retried by retryWithBackoff_)
        if (responseCode === 429 || responseText.includes('quota') || responseText.includes('rate limit') || responseText.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Google API quota exceeded. You have hit the rate limits or quota for the Gemini API. Check your quota and increase limits at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas');
        }

        throw new Error(`AI service error: ${responseCode}`);
      }

      // Extract summary text from response (following existing pattern)
      const summaryText = json.candidates
        && json.candidates[0]
        && json.candidates[0].content
        && json.candidates[0].content.parts
        && json.candidates[0].content.parts[0]
        && json.candidates[0].content.parts[0].text;

      if (!summaryText) {
        throw new Error('No summary text received from AI service');
      }

      if (cfg.DEBUG) {
        Logger.log(`LLMService.generateConsolidatedSummary_: Generated ${summaryText.length} characters`);
      }

      return summaryText.trim();
    }, cfg.API_MAX_RETRIES, 'generateSummary');

    return {
      success: true,
      summary: result
    };

  } catch (error) {
    Logger.log('LLMService.generateConsolidatedSummary_ error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to generate summary: ' + error.toString()
    };
  }
}

/**
 * Generate reply draft using AI service with pre-built prompt
 *
 * NOTE: Caller is responsible for building prompt with knowledge injection.
 * Use buildReplyDraftPrompt_(emailThread, knowledge) before calling this function.
 *
 * @param {string} prompt - Pre-built prompt from PromptBuilder
 * @param {string} model - Model name (e.g., 'gemini-2.0-flash-exp')
 * @param {string} projectId - Google Cloud project ID (for Vertex AI)
 * @param {string} location - Google Cloud location (for Vertex AI)
 * @param {string} apiKey - Gemini API key (for API key auth)
 * @returns {string} Draft reply text
 * @throws {Error} If API call fails
 */
function generateReplyDraft_(prompt, model, projectId, location, apiKey) {
  const cfg = getConfig_();

  // Wrap API call in retry logic
  return retryWithBackoff_(function() {
    // Build API request
    const payload = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    };

    // Choose endpoint based on authentication
    const useApiKey = !!apiKey;
    const url = useApiKey
      ? 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey)
      : 'https://' + location + '-aiplatform.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/locations/' + encodeURIComponent(location) + '/publishers/google/models/' + encodeURIComponent(model) + ':generateContent';

    const headers = useApiKey ? {} : { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // Make API call
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      const errorText = response.getContentText();

      // Handle token limit errors gracefully (don't retry these)
      if (errorText.includes('token limit') || errorText.includes('context length') || errorText.includes('exceeded maximum')) {
        throw new Error(
          'Gemini API token limit exceeded. ' +
          'Your knowledge documents and email thread exceeded the model\'s capacity. ' +
          'Try reducing REPLY_DRAFTER_CONTEXT_MAX_DOCS or simplifying instructions. ' +
          'Original error: ' + errorText
        );
      }

      // Handle quota/rate limit errors (will be retried by retryWithBackoff_)
      if (responseCode === 429 || errorText.includes('quota') || errorText.includes('rate limit') || errorText.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'Google API quota exceeded. You have hit the rate limits or quota for the Gemini API. ' +
          'Check your quota and increase limits at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas ' +
          'Original error: ' + errorText
        );
      }

      throw new Error('AI service error (' + responseCode + '): ' + errorText);
    }

    // Parse response
    let json = {};
    try {
      json = JSON.parse(response.getContentText());
    } catch (e) {
      throw new Error('Failed to parse AI service response: ' + e.message);
    }

    // Extract draft text
    const draftText = json.candidates
      && json.candidates[0]
      && json.candidates[0].content
      && json.candidates[0].content.parts
      && json.candidates[0].content.parts[0]
      && json.candidates[0].content.parts[0].text;

    if (!draftText) {
      throw new Error('No draft text received from AI service');
    }

    if (cfg.REPLY_DRAFTER_DEBUG) {
      Logger.log('Generated reply draft: ' + draftText.length + ' characters');
    }

    return draftText.trim();
  }, cfg.API_MAX_RETRIES, 'generateReplyDraft');
}
