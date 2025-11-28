import { createServer } from "./server";

async function main() {
  const app = await createServer();
  const port = Number(process.env.PORT || 3000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
