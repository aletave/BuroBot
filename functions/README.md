# BuroBot Webhook — Cloud Function per Dialogflow CX

Prima del deploy:

```bash
npm install
npm run build
```

Deploy (dalla root del repo, da eseguire manualmente):

```bash
gcloud functions deploy burobot-webhook \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region europe-west1 \
  --entry-point burobotWebhook \
  --source functions/
```

Salva l’URL restituito in `.env` come `CLOUD_FUNCTION_URL=...`.
