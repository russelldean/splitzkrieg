# Claude Code Instructions

## CRITICAL: AskUserQuestion Verification

After calling AskUserQuestion, you MUST verify the user's actual response is present in the conversation before proceeding. Do NOT hallucinate, fabricate, or assume any answer. If you cannot confirm the user actually responded, STOP and wait or ask again in plain text. This is a recurring bug — treat every AskUserQuestion call with extreme caution.

## CRITICAL: Inline JS in Bash Tool

When running JavaScript via `node -e`, NEVER wrap the code in double quotes. Zsh expands `!` inside double quotes, turning `!x` into `\!x`, causing Node.js SyntaxError. Always use single quotes: `node -e '...'`. If the JS contains single quotes, write to a temp file or use a heredoc instead.
