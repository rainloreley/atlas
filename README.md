# Atlas

Video Remote Control program to play videos on an external device on the same network

## Setup

1. Open the client application on the remote computer
2. Allow network access (if requested by the OS)
3. Add videos to the path shown on the screen
4. Open the controller website on the local computer
5. Enter the IP address shown on the remote computer and click on "Connect"

## Limitations

This program is just a small test to see if this setup works. Following features are (currently) missing:

- Encryption/password protection
- individual projects
- file upload to remote computer
- duplication of videos

## Build

### Client

```bash
git clone "https://github.com/rainloreley/atlas"
cd atlas/client
npm install
npm run build
```

### Controller

```bash
git clone "https://github.com/rainloreley/atlas"
cd atlas/controller
npm install
npm buildstatic
```

## License

This project is licensed under the [MIT License](LICENSE)