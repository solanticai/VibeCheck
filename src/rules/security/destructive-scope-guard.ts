import type { Rule, RuleResult } from '../../types.js';

const CLOUD_DESTRUCTIVE_PATTERNS: Array<[string, RegExp, string]> = [
  ['aws s3 rm recursive', /aws\s+s3\s+rm\s+[^\n]*--recursive/i, 'Recursive S3 delete'],
  ['aws s3 rb --force', /aws\s+s3\s+rb\s+[^\n]*--force/i, 'Force-delete S3 bucket'],
  ['aws ec2 terminate-instances', /aws\s+ec2\s+terminate-instances/i, 'Terminate EC2 instances'],
  ['aws rds delete', /aws\s+rds\s+delete-db-(?:instance|cluster)/i, 'Delete RDS database'],
  ['aws dynamodb delete-table', /aws\s+dynamodb\s+delete-table/i, 'Delete DynamoDB table'],
  ['gcloud instances delete', /gcloud\s+compute\s+instances\s+delete/i, 'Delete GCE instances'],
  ['gcloud sql delete', /gcloud\s+sql\s+instances\s+delete/i, 'Delete Cloud SQL instance'],
  ['gcloud storage rm', /gcloud\s+storage\s+rm\s+[^\n]*--recursive/i, 'Recursive GCS delete'],
  ['kubectl delete namespace', /kubectl\s+delete\s+(?:namespace|ns)\b/i, 'Delete K8s namespace'],
  ['kubectl delete --all', /kubectl\s+delete\s+[^\n]*--all\b/i, 'Bulk K8s resource delete'],
  ['kubectl drain', /kubectl\s+drain\s+[^\n]*--force/i, 'Force-drain K8s node'],
  ['psql DROP DATABASE', /psql\s+[^\n]*-c\s+["'][^"']*DROP\s+DATABASE/i, 'Drop Postgres database'],
  [
    'psql DROP TABLE',
    /psql\s+[^\n]*-c\s+["'][^"']*DROP\s+TABLE/i,
    'Drop Postgres table (outside migration)',
  ],
  ['psql TRUNCATE', /psql\s+[^\n]*-c\s+["'][^"']*TRUNCATE/i, 'Truncate Postgres table'],
  ['supabase db reset', /supabase\s+db\s+reset/i, 'Reset Supabase database (destroys data)'],
  ['supabase projects delete', /supabase\s+projects\s+delete/i, 'Delete Supabase project'],
  ['gh repo delete', /gh\s+repo\s+delete/i, 'Delete GitHub repository'],
  ['gh release delete', /gh\s+release\s+delete/i, 'Delete GitHub release'],
  ['heroku apps:destroy', /heroku\s+apps:destroy/i, 'Destroy Heroku app'],
  ['vercel remove', /vercel\s+remove\s+[^\n]*--yes/i, 'Remove Vercel deployment'],
  ['docker system prune -a', /docker\s+system\s+prune\s+[^\n]*-a/i, 'Full Docker system prune'],
  ['docker volume prune', /docker\s+volume\s+prune\s+[^\n]*-f/i, 'Force Docker volume prune'],
  [
    'terraform destroy',
    /terraform\s+destroy\s+[^\n]*-auto-approve/i,
    'Terraform destroy with auto-approve',
  ],
  ['pulumi destroy', /pulumi\s+destroy\s+[^\n]*--yes/i, 'Pulumi destroy without confirmation'],
];

/**
 * security/destructive-scope-guard
 *
 * Extends `security/destructive-commands` to cloud-CLI verbs that don't
 * appear in the classic Unix set but routinely destroy production state:
 * AWS/GCP/kubectl/psql/supabase/gh/heroku/vercel/docker/terraform/pulumi.
 * Addresses OWASP Agentic ASI02 (Tool Misuse).
 */
export const destructiveScopeGuard: Rule = {
  id: 'security/destructive-scope-guard',
  name: 'Destructive Scope Guard',
  description:
    'Blocks cloud/infra CLI commands that destroy production state (aws/gcloud/kubectl/psql/gh/etc.).',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/destructive-scope-guard';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    for (const [name, pattern, description] of CLOUD_DESTRUCTIVE_PATTERNS) {
      if (pattern.test(command)) {
        return {
          status: 'block',
          ruleId,
          message: `Destructive cloud/infra command detected: ${name}. ${description}.`,
          fix: `Run this command manually outside the AI agent after confirming it targets the intended environment. Never auto-execute prod-scope destructive verbs.`,
          metadata: { pattern: name },
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
