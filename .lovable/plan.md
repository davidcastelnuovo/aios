
The error is clear from the logs:
```
Error sending report: Green API error: {"error":"file should not be empty"}
```

This happens in `send-green-api-file` edge function. The dashboard snapshot is being captured (0.34MB blob, 1200x3108) but the file arrives empty at Green API.

Let me investigate the send flow.
