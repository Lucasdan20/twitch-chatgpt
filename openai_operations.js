import OpenAI from "openai";

export class OpenAIOperations {
  constructor(file_context, openai_key, model_name, history_length) {
    // guarda só o contexto base do arquivo
    this.baseContext = file_context || "";
    this.openai = new OpenAI({ apiKey: openai_key });
    this.model_name = model_name;
    this.history_length = history_length; // não vamos usar por enquanto
  }

  check_history_length() {
    // deixei aqui só pra não quebrar nada que chame esse método,
    // mas por enquanto não usamos histórico.
    return;
  }

  async make_openai_call(text, channelMode = "default") {
    try {
      // 🎭 personalidade por canal
      const personalityPrompt = {
        bunny: `
Você é a Jurema, co-host da Bunny no canal "coelhodebaunilha".
Fale de forma fofa, divertida e carinhosa, como amiga de chat.
Use emojis às vezes, gírias leves e muito afeto.
`,
        biack: `
Você é a Jurema, co-pilot do Biack no canal "biack_frost".
Fale com humor, um pouco de sarcasmo e vibe gamer, mas sempre simpática.
Nada de linguagem técnica demais, é papo de chat.
`,
        default: `
Você é a Jurema, bot simpática de um canal da Twitch.
Fale como uma pessoa real do chat, sempre em português.
`
      };

      const selectedPersonality =
        personalityPrompt[channelMode] || personalityPrompt.default;

      const systemPrompt = `
${selectedPersonality}

Regras gerais:
- Fale SEMPRE em português brasileiro.
- Responda em UMA mensagem única, sem dividir em partes.
- Não use listas, tópicos, "-" ou "•". Escreva em frases normais.
- Nunca peça para colar trechos, nem fale sobre "contexto anterior" ou "please paste".
- Seja direta, natural e com no máximo umas 3–4 frases.

Contexto do canal:
${this.baseContext}
      `.trim();

      console.log("🎭 Modo:", channelMode);
      console.log("🟢 Enviando para OpenAI:", text);

      const response = await this.openai.chat.completions.create({
        model: this.model_name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.9,
        max_tokens: 500,
      });

      let finalResponse =
        response.choices?.[0]?.message?.content || "Sem resposta do modelo.";

      // limpeza extra de lixo em inglês ou formato estranho
      finalResponse = finalResponse
        .replace(/[-•]\s*/g, "")                               // tira bullets
        .replace(/Please|constraints|paste|upload|file/gi, "") // tira restos em inglês
        .trim();

      if (finalResponse.length > 1200) {
        finalResponse = finalResponse.slice(0, 1180).trim() + "…";
      }

      console.log("🤖 Resposta final:", finalResponse);
      return finalResponse;
    } catch (error) {
      console.error("❌ Erro OpenAI:", error);
      return "Deu um tilt rápido aqui, tenta mandar de novo 😅";
    }
  }

  // se em algum lugar ainda chamarem isso, deixo uma versão simples
  async make_openai_call_completion(text) {
    return this.make_openai_call(text);
  }
}
