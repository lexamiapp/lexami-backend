import axios from "axios";

export const getEmbedding = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      content: {
        parts: [{ text }],
      },
    }
  );

  return response.data.embedding.values;
};