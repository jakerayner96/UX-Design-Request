export default {
  async fetch(request) {
    return new Response('Not found', { status: 404 });
  },
};
