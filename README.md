# ElizaTown

<div align="center">
  <img src="https://eliza.town/assets/android-chrome-512x512.png" alt="ElizaTown Logo" width="200"/>
  <br/>
  <a href="https://discord.gg/RtZGvczt">
    <img src="https://img.shields.io/discord/1331618536262602813?color=7289da&logo=discord&logoColor=white" alt="Discord">
  </a>
</div>

An open-source platform for sharing and discovering AI character files. Think of it as a community hub where creators can upload their character files, share them with others, and discover new characters created by the community.

## Features

- 🔐 GitHub authentication
- 📤 Upload character files with images
- ❤️ Like and download tracking
- 🔍 Search characters by name
- 👥 User profiles
- 📱 Responsive design

## Tech Stack

- React + TypeScript
- Supabase (Auth, DB, Storage)
- TailwindCSS
- Lucide Icons
- React Dropzone

## Setup

1. Clone the repository:
```bash
git clone https://github.com/ShadovvBeast/ElizaTown.git
cd elizatown
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
bun dev
```

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

## License

MIT Licensed - see [LICENSE](LICENSE) file