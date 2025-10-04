function categorizeBatch_(prompt, model, projectId, location, apiKey) {
  // Prompt is already built by PromptBuilder - just make the API call
  const payload = { contents: [{ role: 'user', parts: [{ text: prompt }]}] };

  if (PropertiesService.getScriptProperties().getProperty('DEBUG') === 'true') {
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

    // Token limit errors
    if (errorMsg.includes('token limit') || errorMsg.includes('context length') || errorMsg.includes('exceeded maximum')) {
      throw new Error(
        'Gemini API token limit exceeded. ' +
        'Your knowledge documents and emails exceeded the model\'s 1M token capacity. ' +
        'Try reducing LABEL_KNOWLEDGE_MAX_DOCS or processing fewer emails. ' +
        'Original error: ' + errorMsg
      );
    }

    // Quota/rate limit errors
    if (responseCode === 429 || errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Google API quota exceeded. You have hit the rate limits or quota for the Gemini API. ' +
        'Check your quota and increase limits at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas ' +
        'Original error: ' + errorMsg
      );
    }
  }

  if (PropertiesService.getScriptProperties().getProperty('DEBUG') === 'true') {
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
    if (PropertiesService.getScriptProperties().getProperty('DEBUG') === 'true') {
      console.log(JSON.stringify({ retry: true, httpStatus: res.getResponseCode(), raw: json }, null, 2));
    }
    txt = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text) || '';
    out = parseOut(txt);
  }

  if (!out) {
    if (PropertiesService.getScriptProperties().getProperty('DEBUG') === 'true') {
      console.log(JSON.stringify({ parsedEmails: null, reason: 'malformed-json-or-empty' }, null, 2));
    }
    // Return null to signal parsing failure - caller handles fallback logic
    return null;
  }
  return out;
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
      return {
        success: false,
        error: 'Failed to parse AI service response'
      };
    }

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('LLM API error: ' + responseText);

      // Handle quota/rate limit errors
      if (responseCode === 429 || responseText.includes('quota') || responseText.includes('rate limit') || responseText.includes('RESOURCE_EXHAUSTED')) {
        return {
          success: false,
          error: 'Google API quota exceeded. You have hit the rate limits or quota for the Gemini API. Check your quota and increase limits at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas'
        };
      }

      return {
        success: false,
        error: `AI service error: ${responseCode}`
      };
    }

    // Extract summary text from response (following existing pattern)
    const summaryText = json.candidates
      && json.candidates[0]
      && json.candidates[0].content
      && json.candidates[0].content.parts
      && json.candidates[0].content.parts[0]
      && json.candidates[0].content.parts[0].text;

    if (!summaryText) {
      return {
        success: false,
        error: 'No summary text received from AI service'
      };
    }

    if (cfg.DEBUG) {
      Logger.log(`LLMService.generateConsolidatedSummary_: Generated ${summaryText.length} characters`);
    }

    return {
      success: true,
      summary: summaryText.trim()
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

    // Handle token limit errors gracefully
    if (errorText.includes('token limit') || errorText.includes('context length') || errorText.includes('exceeded maximum')) {
      throw new Error(
        'Gemini API token limit exceeded. ' +
        'Your knowledge documents and email thread exceeded the model\'s capacity. ' +
        'Try reducing REPLY_DRAFTER_CONTEXT_MAX_DOCS or simplifying instructions. ' +
        'Original error: ' + errorText
      );
    }

    // Handle quota/rate limit errors
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
}
