/**
 * SDA AI Coach — Remote AI Gateway Exports (Phase 36A Hotfix)
 *
 * Re-exports the authoritative server-side AI gateway functions and constants
 * from api/_coach/ for test suites and backward compatibility.
 */

export {
  handleCoachGatewayRequest,
  validateGatewayRequest,
  validateAndReconcileAIResponse,
  buildAIKnowledgeProjection,
  buildSDAAISystemInstructions,
  buildSDAGroundingPack,
  compileSDASystemPrompt,
  callAIProvider,
  setMockAIHandlerForTesting,
  GATEWAY_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  MAX_CONVERSATION_HISTORY,
  CANONICAL_ACTION_TYPES,
  CANONICAL_CHECKIN_STATUSES,
  type RequestValidationResult,
} from '../../../api/_coach/index';
