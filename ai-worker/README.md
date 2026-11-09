# Optional Daymark AI Curriculum Import Worker

Daymark's local OCR and editable text-import workflow does not require this Worker. This optional Worker enables the **Interpret with AI** button to inspect page images and return structured table-of-contents data.

## Important security notes

- Do not put an OpenAI API key in `index.html`, `app.js`, `styles.css`, or the browser settings.
- The API key belongs in a Cloudflare Worker secret named `OPENAI_API_KEY`.
- Set a private `DAYMARK_IMPORT_TOKEN` Worker secret. Enter the same token in Daymark's import wizard. This protects the endpoint from casual use by other visitors.
- Set `ALLOWED_ORIGIN` to the exact origin serving Daymark. For a local `file://` app, browsers commonly send the origin `null`, so the included `wrangler.toml` uses `null`. That is less restrictive than a specific hosted origin; the access token is therefore strongly recommended. For a hosted app, use its exact origin instead (for example `https://planner.example.com`).
- AI image interpretation sends the selected page images and OCR text to your configured Worker and AI provider only after the user checks the explicit consent box. Provider API usage may incur charges. Have a parent/guardian handle any account, billing, or secret setup that requires an adult.

## Deploy with Wrangler

1. Install and authenticate Wrangler using Cloudflare's current instructions.
2. From this folder, set the API key as a secret:

   ```bash
   npx wrangler secret put OPENAI_API_KEY
   ```

3. Set a long random access token:

   ```bash
   npx wrangler secret put DAYMARK_IMPORT_TOKEN
   ```

4. Review `wrangler.toml`. For a hosted planner, change `ALLOWED_ORIGIN` to the exact HTTPS origin. For local `file://` testing, keep `null` and use the access token.
5. Deploy:

   ```bash
   npx wrangler deploy
   ```

6. Copy the deployed Worker URL ending in `/import-curriculum` into Daymark → Subjects → Import curriculum → Optional AI vision connection. Enter the same access token and save the connection settings.

## Endpoint

`POST /import-curriculum`

JSON body:

```json
{
  "images": ["data:image/jpeg;base64,..."],
  "ocrText": "Optional text recognized locally by Daymark",
  "structureLabel": "Chapter"
}
```

Response contains `subjectName`, `structureLabel`, `sections`, and `warnings`. The Worker only extracts visible table-of-contents sections. It does not invent videos, experiments, tests, or other activities; Daymark creates those from the template selected in the import wizard.

The Worker uses the OpenAI Responses API with `gpt-6-luna` by default. Override the model with the `OPENAI_MODEL` Worker variable if needed.
