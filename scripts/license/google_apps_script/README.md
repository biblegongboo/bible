# License member management for Google Sheets

1. Open the membership spreadsheet and choose **Extensions → Apps Script**.
2. Paste `Code.gs` into the Apps Script editor and save.
3. In **Project Settings → Script Properties**, add:
   - `LICENSE_SYNC_URL`: `https://vwvxpzktafhiuptsrugq.supabase.co/functions/v1/license-member-sync`
   - `LICENSE_SYNC_SECRET`: the secret configured for the Supabase function.
4. Reload the spreadsheet and use **License 회원관리 → 초기 설정**.

`PRODUCTS` is the final entitlement list. Examples: `REA`, `REA,INS`, `MOR,NOT`, or `ALL`.
Removing a code and pushing the row changes that previous active entitlement to `inactive`.
