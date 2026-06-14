# OpenCode Docs

This package contains the source content for the [OpenCode documentation site](https://docs.opencode.ai), built with [Mintlify](https://mintlify.com).

## Structure

```
docs/
├── docs.json          # Mintlify configuration
├── index.mdx          # Landing page
├── quickstart.mdx     # Quickstart guide
├── essentials/        # Core concept docs
├── ai-tools/          # AI tool integrations
├── development.mdx    # Development guide
├── images/            # Doc images and assets
├── logo/              # Logo assets
├── openapi.json       # API reference spec
└── snippets/          # Reusable MDX snippets
```

## Development

```bash
# Install Mintlify CLI
npm i -g mint

# Start local dev server
cd packages/docs && mint dev
```

The local preview runs at `http://localhost:3000`.

## Publishing

Changes pushed to the default branch are automatically deployed to production via the Mintlify GitHub app.
