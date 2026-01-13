
// Catch-all route to handle missing endpoints gracefully with JSON
export const onRequest = () => new Response(JSON.stringify({ error: "Endpoint not found" }), { 
  status: 404, 
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  } 
});
