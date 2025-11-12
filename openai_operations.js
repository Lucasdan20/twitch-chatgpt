import OpenAI from "openai";

export class OpenAIOperations {
  constructor(file_context, openai_key, model_name, history_length) {
    this.messages = [{ role: "system", content: file_context }];
    this.openai = new OpenAI({ apiKey: openai_key });
    this.model_name = model_name;
    this.history_length = history_length;
  }

  check_history_length() {
    if (this.messages.length > this.history_length * 2 + 1) {
      this.messages.splice(1, 2);
    }
  }

  async make_openai_call(text, channelMode = "default") {
    try {
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      // 🎭 Indicação de modo
      console.log(
        `🎭 Personality: ${
          channelMode === "bunny"
            ? "Bunny Mode 🐰"
            : channelMode === "biack"
            ? "Biack Mode 🧠"
            : "Default Mode"
        }`
      );

      // 🎙️ Personalidades
      const personalityPrompt = {
        bunny: `
Você é a Jurema, co-host da Bunny no canal "coelhodebaunilha".
Fale com leveza e carisma, de forma espontânea, divertida e envolvente.
Use expressões como “ain”, “meudeus”, “socorro” ou “aiii”, mas sem exagero.
Nunca use listas, tópicos ou travessões. Fale sempre em português, em uma única resposta fluida.
Evite continuar respostas — tudo deve caber em um único parágrafo.
`,
        biack: `
Você é a Jurema, co-pilot do Biack no canal "biack_frost".
Seu estilo é sarcástico, rápido, natural e com humor afiado.
Fale como se estivesse num chat de live, sem listas, tópicos ou travessões.
Nunca repita a pergunta, apenas responda de forma direta e divertida.
Tudo deve caber em uma única mensagem curta e natural.
`,
        default: `
Você é a Jurema, co-host de um canal da Twitch.
Fale como uma pessoa real no chat, em português brasileiro.
Nunca use listas, tópicos, nem explicações. Apenas uma resposta única e breve.
`
      };

      const selectedPrompt =
        personalityPrompt[channelMode] || personalityPrompt.default;

      // 🔥 Chamada à API
      const response = await this.openai.chat.completions.create({
        model: this.model_name,
        messages: [
          { role: "system", content: selectedPrompt },
          ...this.messages.slice(-this.history_length),
          { role: "user", content: text },
        ],
        temperature: 0.9,
        max_tokens: 1200, // limite seguro para evitar respostas longas
      });

      // 🧩 Pega resposta e limpa
      let finalResponse =
        response.choices?.[0]?.message?.content || "Sem resposta do modelo.";

      finalResponse = finalResponse
        .replace(/[-•]\s*/g, "") // remove bullets e travessões
        .replace(/\b(?:Please|constraints|Once I have|paste|upload|file|describe)\b.*$/gi, "")
        .replace(/[A-Za-z]{4,}/g, "") // remove qualquer palavra longa em inglês
        .trim();

      // ✂️ Garante que só manda UMA mensagem
      if (finalResponse.length > 1200)
        finalResponse = finalResponse.slice(0, 1180).trim() + "…";

      console.log("🤖 Resposta final:", finalResponse);

      this.messages.push({ role: "assistant", content: finalResponse });
      return finalResponse;
    } catch (error) {
      console.error("❌ Erro OpenAI:", error);
      return "Deu tilt aqui rapidinho, tenta repetir 😅";
    }
  }
}
