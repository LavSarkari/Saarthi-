export type AIErrorType =
  | 'quota_exceeded'
  | 'rate_limit'
  | 'invalid_key'
  | 'network_error'
  | 'server_error'
  | 'model_unavailable'
  | 'unknown';

export type AIErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ParsedAIError {
  errorType: AIErrorType;
  provider: string;
  model: string;
  isUserApiKey: boolean;
  retryAfter?: number;
  displayTitle: string;
  displayMessage: string;
  suggestedAction?: {
    label: string;
    actionType: 'retry' | 'add_key' | 'open_settings' | 'check_status' | 'none';
  };
  severity: AIErrorSeverity;
  originalError: any;
}

export class AIErrorHandler {
  static parseError(
    error: any,
    isUserApiKey: boolean,
    model: string = 'unknown',
    provider: string = 'google'
  ): ParsedAIError {
    // Log the full technical error internally for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[AI Error Internal Log]:', {
        error,
        isUserApiKey,
        model,
        provider,
        timestamp: new Date().toISOString()
      });
    }

    const errorMessage = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.code || 500;

    let errorType: AIErrorType = 'unknown';

    if (
      status === 429 ||
      errorMessage.includes('quota') ||
      errorMessage.includes('resource_exhausted') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('billing') ||
      errorMessage.includes('limit')
    ) {
      errorType = 'quota_exceeded';
    } else if (
      status === 401 ||
      status === 403 ||
      errorMessage.includes('api key') ||
      errorMessage.includes('invalid key') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('permission denied') ||
      errorMessage.includes('unauthenticated')
    ) {
      errorType = 'invalid_key';
    } else if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('offline')
    ) {
      errorType = 'network_error';
    } else if (status >= 500) {
      errorType = 'server_error';
    } else if (
      status === 404 ||
      errorMessage.includes('not found') ||
      errorMessage.includes('model')
    ) {
      errorType = 'model_unavailable';
    }

    let displayTitle = 'An error occurred';
    let displayMessage = 'We encountered an unexpected issue.';
    let suggestedAction: ParsedAIError['suggestedAction'] = { label: 'Retry', actionType: 'retry' };
    let severity: AIErrorSeverity = 'error';

    switch (errorType) {
      case 'quota_exceeded':
        if (isUserApiKey) {
          displayTitle = "You've reached your Gemini API limit";
          displayMessage = "Your personal Gemini API key has exceeded its current quota or rate limit.\n\nThis is controlled by your own Google AI Studio account.\n\nYou can:\n• Wait a few moments and try again\n• Check your quota and billing\n• Upgrade your Gemini plan if necessary";
          suggestedAction = { label: 'Open Google AI Studio', actionType: 'check_status' };
          severity = 'warning';
        } else {
          displayTitle = "Saarthi's shared AI capacity is currently exhausted";
          displayMessage = "To continue instantly, connect your own Gemini API key.\n\nUsing your own key gives:\n✓ Higher limits\n✓ Faster responses\n✓ Private AI requests\n✓ No dependence on shared capacity";
          suggestedAction = { label: 'Add My Gemini API Key', actionType: 'add_key' };
          severity = 'warning';
        }
        break;

      case 'invalid_key':
        if (isUserApiKey) {
          displayTitle = 'Your Gemini API key appears to be invalid';
          displayMessage = 'Please verify your API key in Settings.';
          suggestedAction = { label: 'Open AI Engine Settings', actionType: 'open_settings' };
        } else {
          displayTitle = 'Configuration Error';
          displayMessage = 'There is an issue with the system configuration. Please try again later or provide your own API key.';
          suggestedAction = { label: 'Add My Gemini API Key', actionType: 'add_key' };
        }
        break;

      case 'network_error':
        displayTitle = 'Unable to reach the AI service';
        displayMessage = 'Please check your internet connection and try again.';
        suggestedAction = { label: 'Retry', actionType: 'retry' };
        break;

      case 'server_error':
        displayTitle = 'Something went wrong on our side';
        displayMessage = 'Please try again in a few moments.';
        suggestedAction = { label: 'Retry', actionType: 'retry' };
        break;
        
      case 'model_unavailable':
        displayTitle = 'The selected AI model is currently unavailable';
        displayMessage = 'Saarthi is automatically trying another compatible model.';
        suggestedAction = { label: 'Retry', actionType: 'none' };
        severity = 'info';
        break;

      default:
        displayTitle = 'AI Service Error';
        displayMessage = 'An unexpected issue occurred while communicating with the AI service. Please try again.';
        suggestedAction = { label: 'Retry', actionType: 'retry' };
        break;
    }

    return {
      errorType,
      provider,
      model,
      isUserApiKey,
      displayTitle,
      displayMessage,
      suggestedAction,
      severity,
      originalError: error,
    };
  }
}
