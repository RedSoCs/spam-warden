# Custom Instructions

## Node Invocations & Testing Rules
- Do not use `node -e` to run inline JavaScript snippets. Do not ask the user for permission on it either.
- When creating or running test cases, you must:
  - Create the use case in an existing test file if a matching category/file exists.
  - If a matching category does not exist, create a new test file under the `tests/` directory matching the pattern `tests/test-*.js` and write the tests under that file.
