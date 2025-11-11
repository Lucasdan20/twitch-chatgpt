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
      console.log(
        "Message amount in history exceeded. Removing oldest user and agent messages."
      );
      this.messages.splice(1, 2);
    }
  }

  async make_openai_call(text) {
    try {
      // adiciona a mensagem do usuário ao histórico
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      let agent_response = "";

      // 🔍 Detecta automaticamente se deve usar o endpoint novo ou o antigo
      if (
        this.model_name.startsWith("gpt-5") ||
        this.model_name.startsWith("gpt-4.1") ||
        this.model_name.startsWith("gpt-4o")
      ) {
        // 🚀 Novo endpoint (responses.create)
        const response = await this.openai.responses.create({
          model: this.model_name,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: text
                }
              ]
            }
          ],
          temperature: 1,
          max_output_tokens: 256,
        });

        // Log detalhado pra depuração
        console.log("🔍 Full API response:", JSON.stringify(response, null, 2));

        // Tenta extrair de todos os formatos possíveis
        agent_response =
          response.output_text ||
          response.output?.[0]?.content?.[0]?.text ||
          response.output?.[0]?.content?.text ||
          response.output ||
          "Sem resposta do modelo.";
      } else {
        // 💬 Endpoint antigo (chat.completions.create)
        const response = await this.openai.chat.completions.create({
          model: this.model_name,
          messages: this.messages,
          temperature: 1,
          max_tokens: 256,
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
      return agent_response;
    } catch (error) {
      console.error("❌ OpenAI error:", error);
      return "Sorry, something went wrong. Please try again later.";
    }
  }

  async make_openai_call_completion(text) {
    try {
      const response = await this.openai.completions.create({
        model: "text-davinci-003",
        prompt: text,
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      let agent_response = response.choices?.[0]?.text || "Sem resposta do modelo.";
      console.log(`Agent Response: ${agent_response}`);
      return agent_response;
    } catch (error) {
      console.error("❌ OpenAI completion error:", error);
      return "Sorry, something went wrong. Please try again later.";
    }
  }
}
