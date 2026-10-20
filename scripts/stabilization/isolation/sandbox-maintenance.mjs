// Deploy only to the existing eskahade-sandbox after explicit remote approval.
// Deliberately no imports, bindings, SQL, jobs or bank access.
export default {
  fetch() {
    return Response.json(
      { error: 'Sandbox sedang dalam pemeliharaan. Silakan coba kembali nanti.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' } },
    );
  },
};
