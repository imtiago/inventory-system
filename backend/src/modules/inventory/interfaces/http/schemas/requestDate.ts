import { z } from "zod";
import { businessDateOfInstant } from "@shared/domain/businessDate";

// z.coerce.date() turns null into 1970-01-01 and "" into an invalid date silently
// in some cases; reject both explicitly. Datas de lote são datas sem hora: um instante
// com hora ("...T23:30:00-03:00") vira a data do fuso de negócio à meia-noite UTC,
// para a hora não deslocar a validade.
const UTC_MIDNIGHT = /^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?Z$/;

export const requestDate = z.preprocess(
  (value) => {
    if (value === null || value === "") return "invalid";
    if (typeof value === "string") {
      // Meia-noite UTC é a convenção de data sem hora (ex.: toISO do frontend): vale como está.
      if (UTC_MIDNIGHT.test(value)) return value.slice(0, 10);
      return businessDateOfInstant(value) ?? value;
    }
    return value;
  },
  z.coerce.date(),
);
