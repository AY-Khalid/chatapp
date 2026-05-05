# WhisperBox (ChatApp) --- End-to-End Encrypted Messaging

## Architecture

[Architectural design](https://drive.google.com/file/d/1SE3yKzjM7vWU84YqKb98wnfvd9EsZYT2/view?usp=sharing)

Frontend (Next.js) WhisperBox API (Koyeb) ├─ RSA-OAEP keypair generation
├─ Authentication (JWT + refresh tokens) ├─ AES-GCM message encryption
├─ Stores encrypted message blobs only ├─ IndexedDB key storage ├─ User
directory + public keys ├─ WebSocket real-time messaging ├─
Conversation + message routing └─ REST fallback polling

## Encryption Flow

1.  Registration
    -   Client generates RSA-OAEP 2048-bit key pair in browser
2.  Key Storage
    -   Public key is sent to server
    -   Private key is encrypted with password-derived key and stored
        locally in IndexedDB
3.  Sending a Message
    -   Message is encrypted using AES-GCM (random key per message)
    -   AES key is wrapped using recipient's RSA public key
    -   Also wrapped using sender's public key for self-decryption
4.  Receiving a Message
    -   Client unwraps AES key using RSA private key
    -   Decrypts ciphertext locally using AES-GCM
    -   Server never sees plaintext or encryption keys
5.  Server Role
    -   Stores only encrypted payloads (ciphertext, IV, wrapped keys)
    -   Routes messages via WebSocket or REST
    -   Has no ability to decrypt messages

## Key Management

  ------------------------------------------------------------------------
  Key          Storage             Security Notes
  ------------ ------------------- ---------------------------------------
  Private RSA  IndexedDB           Never sent to server
  Key          (encrypted with     
               password-derived    
               key)                

  Public RSA   Server              Used for encryption only
  Key                              

  AES Message  Memory only         Generated per message, ephemeral
  Key                              

  Auth Tokens  sessionStorage      Short-lived session auth
  ------------------------------------------------------------------------

## Security Design

### Strong Points

-   End-to-end encryption using AES-GCM + RSA-OAEP
-   Private key never leaves client device
-   Per-message symmetric keys improve isolation
-   WebSocket + REST fallback ensures reliability

### Security Trade-offs

1.  Session Storage Tokens
    -   Stored in sessionStorage for reduced persistence risk
    -   Lost on tab close or refresh
2.  No Forward Secrecy
    -   Static RSA keys mean compromise exposes past messages
    -   Full forward secrecy would require Double Ratchet protocol
3.  IndexedDB Key Storage
    -   Private key encrypted locally using password-derived key
    -   Security depends on client device integrity
4.  WebSocket + Polling Hybrid
    -   WebSocket used for real-time messaging
    -   Polling fallback ensures delivery reliability

## Known Limitations

-   Mixed public key formats (SPKI + JWK compatibility layer)
-   No offline message queue
-   First load depends on IndexedDB or server key restore
-   WebSocket fallback may overlap with polling briefly
-   UI not fully optimized for large chat history

## Summary

This system ensures: - Server cannot decrypt messages - All encryption
happens client-side - Keys are properly isolated - Messages remain
encrypted at rest and in transit


[live demo link](https://drive.google.com/file/d/1lkjar_3wkv5vKk1rg4ngQ7TsdwKzPpoI/view?usp=sharing)


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

