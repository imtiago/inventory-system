import { z } from "zod";

// Mensagens padrão do Zod em português; mensagens explícitas dos schemas têm precedência.
z.config(z.locales.pt());
