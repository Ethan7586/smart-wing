import handler from "vinext/server/app-router-entry";

const worker = {
  async fetch(
    request: Request,
    env: Parameters<typeof handler.fetch>[1],
    ctx: Parameters<typeof handler.fetch>[2]
  ): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
