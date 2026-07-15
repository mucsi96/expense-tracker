import { ClaudeRequest } from './types';
import { createClaudeResponse, getMessageContent } from './utils';

export class ChatHandler {
  processRequest(request: ClaudeRequest) {
    const userMessage = request.messages.find((m) => m.role === 'user');
    if (!userMessage) {
      throw new Error('No user message found');
    }

    const content = getMessageContent(userMessage);

    // Match spending insight requests
    if (content.toLowerCase().includes('expense')) {
      return createClaudeResponse(
        'You spent the most on Groceries this month. Consider setting a weekly budget to keep it in check!'
      );
    }

    return createClaudeResponse(
      'Hello! I received your message. How can I help you today?'
    );
  }
}
