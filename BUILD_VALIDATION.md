# Build validation note

The project structure and TypeScript source were statically checked in the working environment. The environment did not have the npm dependency tarballs cached, and repeated `npm ci` attempts timed out, so a full `next build` could not be completed locally here.

Run `npm ci && npm run build` in CI/Vercel for the final production build verification.
