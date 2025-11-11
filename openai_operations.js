// Importa o SDK oficial da OpenAI
import OpenAI from "openai";

export class OpenAIOperations {
  constructor(file_context, openai_key, model_name, history_length) {
    this.messages = [{ role: "system", content: file_context }];
    this.openai = new OpenAI({ apiKey: openai_key });
    this.model_name = model_name;
    this.history_length = history_length;
  }

  check_history_length() {
    console.log(
      `Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`
    );
    if (this.messages.length > this.history_length * 2 + 1) {
      console.log("Message amount in history exceeded. Removing oldest user and agent messages.");
      this.messages.splice(1, 2);
    }
  }

  // =======================================================================
  // 🚀 PRINCIPAL — chamada GPT (usado pelo !gpt)
  // =======================================================================
  async make_openai_call(text) {
    try {
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      let agent_response = "";
      console.log("🟢 Enviando para OpenAI:", text);

      // ==============================================================
      // GPT-5 / 4.1 / 4o (novo endpoint responses.create)
      // ==============================================================
      if (
        this.model_name.startsWith("gpt-5") ||
        this.model_name.startsWith("gpt-4.1") ||
        this.model_name.startsWith("gpt-4o")
      ) {
        let response;
        let full_output = [];
        let incomplete = true;
        let iteration = 0;

        // 🔁 Faz várias requisições automáticas até completar (auto continue)
        while (incomplete && iteration < 5) {
          iteration++;
          console.log(`⚙️ Gerando parte ${iteration} da resposta...`);

          response = await this.openai.responses.create({
            model: this.model_name,
            input: [
              {
                role: "user",
                content: [
                  { type: "input_text", text: iteration === 1 ? text : "continue" }
                ]
              }
            ],
            temperature: 1,
            max_output_tokens: 1024,
          });

          console.log(`📦 Parte ${iteration}:`, response.status);

          if (response.output && response.output.length > 0) {
            full_output.push(...response.output);
          }

          // Sai do loop se a resposta estiver completa
          incomplete = response.status === "incomplete" && 
                       response.incomplete_details?.reason === "max_output_tokens";
        }

        // 🔹 Extrai texto consolidado
        const textParts = full_output
          .map((item) => {
            if (item.type === "output_text") return item.content?.[0]?.text;
            if (item.type === "reasoning") return item.summary?.join(" ");
            return null;
          })
          .filter(Boolean);

        agent_response = textParts.join(" ").trim() || "Sem resposta do modelo.";

      // ==============================================================
      // GPT-3.5 ou anterior (chat.completions)
      // ==============================================================
      } else {
        const response = await this.openai.chat.completions.create({
          model: this.model_name,
          messages: this.messages,
          temperature: 1,
          max_tokens: 1024,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });

        agent_response =
          response.choices?.[0]?.message?.content ||
          "Sem resposta do modelo.";
      }

      console.log(`🤖 Agent Response: ${agent_response}`);

      this.messages.push({ role: "assistant", content: agent_response });

      if (typeof agent_response !== "string") {
        agent_response = JSON.stringify(agent_response);
      }

      return agent_response;

    } catch (error) {
      console.error("❌ OpenAI error:", error);
      if (error.response) {
        console.error("🔻 Response status:", error.response.status);
        console.error("🔻 Response data:", JSON.stringify(error.response.data, null, 2));
      }
      return "Desculpe, algo deu errado. Tente novamente 💜";
    }
  }

  // =======================================================================
  // ✏️ Modo PROMPT (usado se GPT_MODE = PROMPT)
  // =======================================================================
  async make_openai_call_completion(text) {
    try {
      const response = await this.openai.completions.create({
        model: "text-davinci-003",
        prompt: text,
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      let agent_response = response.choices?.[0]?.text || "Sem resposta do modelo.";
      console.log(`Agent Response: ${agent_response}`);
      return agent_response;
    } catch (error) {
      console.error("❌ OpenAI error:", error);
      if (error.response) {
        console.error("🔻 Response status:", error.response.status);
        console.error("🔻 Response data:", JSON.stringify(error.response.data, null, 2));
      }
      return "Desculpe, algo deu errado. Tente novamente 💜";
    }
  }
}
