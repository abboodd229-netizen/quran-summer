import type { Response } from 'express';

interface Client {
  id: number;
  res: Response;
}

let seq = 0;
const clients = new Set<Client>();

/** يسجّل عميلًا جديدًا على قناة SSE */
export function addClient(res: Response): () => void {
  const client: Client = { id: ++seq, res };
  clients.add(client);
  res.write(`event: connected\ndata: {"ok":true}\n\n`);
  return () => clients.delete(client);
}

/** يبثّ حدثًا لكل العملاء المتّصلين */
export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    try {
      c.res.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}

/** نبضة دورية لإبقاء الاتصال حيًّا عبر الوسطاء */
setInterval(() => {
  for (const c of clients) {
    try {
      c.res.write(`: ping\n\n`);
    } catch {
      clients.delete(c);
    }
  }
}, 25_000).unref();
