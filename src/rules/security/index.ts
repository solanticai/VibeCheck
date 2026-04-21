import type { Rule } from '../../types.js';
import { branchProtection } from './branch-protection.js';
import { destructiveCommands } from './destructive-commands.js';
import { secretDetection } from './secret-detection.js';
import { promptInjection } from './prompt-injection.js';
import { dependencyAudit } from './dependency-audit.js';
import { envExposure } from './env-exposure.js';
import { rlsRequired } from './rls-required.js';
import { unsafeEval } from './unsafe-eval.js';
import { noHardcodedUrls } from './no-hardcoded-urls.js';
import { xssPrevention } from './xss-prevention.js';
import { sqlInjection } from './sql-injection.js';
import { curlPipeShell } from './curl-pipe-shell.js';
import { memoryFileWriteGuard } from './memory-file-write-guard.js';
import { mcpServerAllowlist } from './mcp-server-allowlist.js';
import { mcpCredentialScope } from './mcp-credential-scope.js';
import { mcpToolDescriptionDiff } from './mcp-tool-description-diff.js';
import { packageHallucinationGuard } from './package-hallucination-guard.js';
import { packageTyposquatGuard } from './package-typosquat-guard.js';
import { logInjection } from './log-injection.js';
import { pathTraversal } from './path-traversal.js';
import { xxePrevention } from './xxe-prevention.js';
import { weakCrypto } from './weak-crypto.js';
import { insecureDeserialization } from './insecure-deserialization.js';
import { broadCors } from './broad-cors.js';
import { missingAuthz } from './missing-authz.js';
import { jwtValidation } from './jwt-validation.js';
import { egressAllowlist } from './egress-allowlist.js';
import { destructiveScopeGuard } from './destructive-scope-guard.js';
import { credentialContextGuard } from './credential-context-guard.js';
import { agentConfigLeakage } from './agent-config-leakage.js';
import { fetchedContentInjection } from './fetched-content-injection.js';
import { untrustedContextFence } from './untrusted-context-fence.js';
import { agentOutputToExec } from './agent-output-to-exec.js';
import { secretInAgentOutput } from './secret-in-agent-output.js';
import { mcpStdioCommandValidation } from './mcp-stdio-command-validation.js';
import { mcpNoDynamicToolRegistration } from './mcp-no-dynamic-tool-registration.js';
import { mcpToolDescriptionSanitize } from './mcp-tool-description-sanitize.js';
import { mcpCapabilityDisclosure } from './mcp-capability-disclosure.js';
import { mcpUrlScheme } from './mcp-url-scheme.js';
import { agentsmdIntegrity } from './agentsmd-integrity.js';
import { untrustedToolRegistration } from './untrusted-tool-registration.js';
import { lockfileRequired } from './lockfile-required.js';
import { ragSourceAllowlist } from './rag-source-allowlist.js';
import { embeddingSourceIntegrity } from './embedding-source-integrity.js';
import { toolLeastPrivilege } from './tool-least-privilege.js';
import { subagentBoundary } from './subagent-boundary.js';
import { k8sRunAsNonRoot } from './k8s-run-as-non-root.js';
import { k8sNoPrivilegedContainers } from './k8s-no-privileged-containers.js';
import { k8sResourceLimits } from './k8s-resource-limits.js';
import { k8sNoHostpath } from './k8s-no-hostpath.js';
import { k8sImagePinnedDigest } from './k8s-image-pinned-digest.js';
import { k8sNoDefaultNamespace } from './k8s-no-default-namespace.js';
import { bunLockfileIntegrity } from './bun-lockfile-integrity.js';
import { bunShellExecScan } from './bun-shell-exec-scan.js';
import { bunNoUnverifiedInstall } from './bun-no-unverified-install.js';
import { mongoNoOperatorInjection } from './mongo-no-operator-injection.js';
import { mongoNoDollarWhere } from './mongo-no-dollar-where.js';
import { mongoStrictSchemaValidation } from './mongo-strict-schema-validation.js';
import { mongoNoUnboundProjection } from './mongo-no-unbound-projection.js';
import { nestjsRequireGuards } from './nestjs-require-guards.js';
import { nestjsHelmetMiddleware } from './nestjs-helmet-middleware.js';
import { nestjsThrottlerConfigured } from './nestjs-throttler-configured.js';
import { nestjsClassValidatorDtos } from './nestjs-class-validator-dtos.js';
import { nuxtEnvVarPrefix } from './nuxt-env-var-prefix.js';
import { nuxtSecurityHeaders } from './nuxt-security-headers.js';
import { trpcRequireInputValidation } from './trpc-require-input-validation.js';
import { trpcAuthMiddleware } from './trpc-auth-middleware.js';
import { trpcNoLeakedServerOnly } from './trpc-no-leaked-server-only.js';
import { zodServerActionInput } from './zod-server-action-input.js';
import { expoNoPlainSecureStore } from './expo-no-plain-secure-store.js';
import { expoEasUpdateSigning } from './expo-eas-update-signing.js';
import { expoConfigPluginReview } from './expo-config-plugin-review.js';
import { expoNoExperimentalRscInProd } from './expo-no-experimental-rsc-in-prod.js';
import { graphqlNoIntrospectionInProd } from './graphql-no-introspection-in-prod.js';
import { graphqlDepthLimit } from './graphql-depth-limit.js';
import { graphqlComplexityLimit } from './graphql-complexity-limit.js';
import { graphqlResolverInputValidation } from './graphql-resolver-input-validation.js';
import { denoPermissionsAudit } from './deno-permissions-audit.js';
import { denoImportMapPinning } from './deno-import-map-pinning.js';
import { denoNoEvalFfi } from './deno-no-eval-ffi.js';
import { grpcTlsRequired } from './grpc-tls-required.js';
import { grpcAuthInterceptor } from './grpc-auth-interceptor.js';
import { grpcMaxMessageSize } from './grpc-max-message-size.js';
import { grpcDeadlinePropagation } from './grpc-deadline-propagation.js';
import { railsMassAssignmentStrongParams } from './rails-mass-assignment-strong-params.js';
import { railsBrakemanRequired } from './rails-brakeman-required.js';
import { railsCspDefaultDeny } from './rails-csp-default-deny.js';
import { railsEncryptedAttrOnPii } from './rails-encrypted-attr-on-pii.js';
import { redisNoUnauthenticatedClient } from './redis-no-unauthenticated-client.js';
import { redisNoEvalUserInput } from './redis-no-eval-user-input.js';
import { redisNoKeysStarInProd } from './redis-no-keys-star-in-prod.js';
import { phoenixSobelowRequired } from './phoenix-sobelow-required.js';
import { phoenixMixAuditRequired } from './phoenix-mix-audit-required.js';
import { phoenixLiveviewCsrf } from './phoenix-liveview-csrf.js';
import { phoenixRawSqlFragmentScan } from './phoenix-raw-sql-fragment-scan.js';

export const securityRules: Rule[] = [
  branchProtection,
  destructiveCommands,
  secretDetection,
  promptInjection,
  dependencyAudit,
  envExposure,
  rlsRequired,
  unsafeEval,
  noHardcodedUrls,
  xssPrevention,
  sqlInjection,
  curlPipeShell,
  memoryFileWriteGuard,
  mcpServerAllowlist,
  mcpCredentialScope,
  mcpToolDescriptionDiff,
  packageHallucinationGuard,
  packageTyposquatGuard,
  logInjection,
  pathTraversal,
  xxePrevention,
  weakCrypto,
  insecureDeserialization,
  broadCors,
  missingAuthz,
  jwtValidation,
  egressAllowlist,
  destructiveScopeGuard,
  credentialContextGuard,
  agentConfigLeakage,
  fetchedContentInjection,
  untrustedContextFence,
  agentOutputToExec,
  secretInAgentOutput,
  mcpStdioCommandValidation,
  mcpNoDynamicToolRegistration,
  mcpToolDescriptionSanitize,
  mcpCapabilityDisclosure,
  mcpUrlScheme,
  agentsmdIntegrity,
  untrustedToolRegistration,
  lockfileRequired,
  ragSourceAllowlist,
  embeddingSourceIntegrity,
  toolLeastPrivilege,
  subagentBoundary,
  k8sRunAsNonRoot,
  k8sNoPrivilegedContainers,
  k8sResourceLimits,
  k8sNoHostpath,
  k8sImagePinnedDigest,
  k8sNoDefaultNamespace,
  bunLockfileIntegrity,
  bunShellExecScan,
  bunNoUnverifiedInstall,
  mongoNoOperatorInjection,
  mongoNoDollarWhere,
  mongoStrictSchemaValidation,
  mongoNoUnboundProjection,
  nestjsRequireGuards,
  nestjsHelmetMiddleware,
  nestjsThrottlerConfigured,
  nestjsClassValidatorDtos,
  nuxtEnvVarPrefix,
  nuxtSecurityHeaders,
  trpcRequireInputValidation,
  trpcAuthMiddleware,
  trpcNoLeakedServerOnly,
  zodServerActionInput,
  expoNoPlainSecureStore,
  expoEasUpdateSigning,
  expoConfigPluginReview,
  expoNoExperimentalRscInProd,
  graphqlNoIntrospectionInProd,
  graphqlDepthLimit,
  graphqlComplexityLimit,
  graphqlResolverInputValidation,
  denoPermissionsAudit,
  denoImportMapPinning,
  denoNoEvalFfi,
  grpcTlsRequired,
  grpcAuthInterceptor,
  grpcMaxMessageSize,
  grpcDeadlinePropagation,
  railsMassAssignmentStrongParams,
  railsBrakemanRequired,
  railsCspDefaultDeny,
  railsEncryptedAttrOnPii,
  redisNoUnauthenticatedClient,
  redisNoEvalUserInput,
  redisNoKeysStarInProd,
  phoenixSobelowRequired,
  phoenixMixAuditRequired,
  phoenixLiveviewCsrf,
  phoenixRawSqlFragmentScan,
];

export {
  branchProtection,
  destructiveCommands,
  secretDetection,
  promptInjection,
  dependencyAudit,
  envExposure,
  rlsRequired,
  unsafeEval,
  noHardcodedUrls,
  xssPrevention,
  sqlInjection,
  curlPipeShell,
  memoryFileWriteGuard,
  mcpServerAllowlist,
  mcpCredentialScope,
  mcpToolDescriptionDiff,
  packageHallucinationGuard,
  packageTyposquatGuard,
  logInjection,
  pathTraversal,
  xxePrevention,
  weakCrypto,
  insecureDeserialization,
  broadCors,
  missingAuthz,
  jwtValidation,
  egressAllowlist,
  destructiveScopeGuard,
  credentialContextGuard,
  agentConfigLeakage,
  fetchedContentInjection,
  untrustedContextFence,
  agentOutputToExec,
  secretInAgentOutput,
  mcpStdioCommandValidation,
  mcpNoDynamicToolRegistration,
  mcpToolDescriptionSanitize,
  mcpCapabilityDisclosure,
  mcpUrlScheme,
  agentsmdIntegrity,
  untrustedToolRegistration,
  lockfileRequired,
  ragSourceAllowlist,
  embeddingSourceIntegrity,
  toolLeastPrivilege,
  subagentBoundary,
  k8sRunAsNonRoot,
  k8sNoPrivilegedContainers,
  k8sResourceLimits,
  k8sNoHostpath,
  k8sImagePinnedDigest,
  k8sNoDefaultNamespace,
  bunLockfileIntegrity,
  bunShellExecScan,
  bunNoUnverifiedInstall,
  mongoNoOperatorInjection,
  mongoNoDollarWhere,
  mongoStrictSchemaValidation,
  mongoNoUnboundProjection,
  nestjsRequireGuards,
  nestjsHelmetMiddleware,
  nestjsThrottlerConfigured,
  nestjsClassValidatorDtos,
  nuxtEnvVarPrefix,
  nuxtSecurityHeaders,
  trpcRequireInputValidation,
  trpcAuthMiddleware,
  trpcNoLeakedServerOnly,
  zodServerActionInput,
  expoNoPlainSecureStore,
  expoEasUpdateSigning,
  expoConfigPluginReview,
  expoNoExperimentalRscInProd,
  graphqlNoIntrospectionInProd,
  graphqlDepthLimit,
  graphqlComplexityLimit,
  graphqlResolverInputValidation,
  denoPermissionsAudit,
  denoImportMapPinning,
  denoNoEvalFfi,
  grpcTlsRequired,
  grpcAuthInterceptor,
  grpcMaxMessageSize,
  grpcDeadlinePropagation,
  railsMassAssignmentStrongParams,
  railsBrakemanRequired,
  railsCspDefaultDeny,
  railsEncryptedAttrOnPii,
  redisNoUnauthenticatedClient,
  redisNoEvalUserInput,
  redisNoKeysStarInProd,
  phoenixSobelowRequired,
  phoenixMixAuditRequired,
  phoenixLiveviewCsrf,
  phoenixRawSqlFragmentScan,
};
