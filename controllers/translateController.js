export const translateText = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `
Translate the following text into ${targetLanguage}.
Keep formatting same. Do not change meaning.

TEXT:
${text}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const translated =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Translation failed";

    res.json({ translated });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};