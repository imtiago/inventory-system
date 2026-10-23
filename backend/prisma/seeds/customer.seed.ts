import { PrismaClient } from "@prisma/client";
import { SequentialNumberGenerator } from "../../src/shared/application/services/SequentialNumberGenerator";
import { NumberRangeName } from "../../src/shared/domain/enums/NumberRangeName";

export async function seedCustomers(prisma: PrismaClient) {
  const customers = [
    {
      name: "João Silva",
      email: "joao.silva@email.com",
      phone: "68999011001",
      address: "Rua das Flores, 120",
    },
    {
      name: "Maria Santos",
      email: "maria.santos@email.com",
      phone: "68999011002",
      address: "Av. Brasil, 450",
    },
    {
      name: "Carlos Oliveira",
      email: "carlos.oliveira@email.com",
      phone: "68999011003",
      address: "Rua Acre, 85",
    },
    {
      name: "Ana Souza",
      email: "ana.souza@email.com",
      phone: "68999011004",
      address: "Rua Rio Branco, 210",
    },
    {
      name: "Pedro Costa",
      email: "pedro.costa@email.com",
      phone: "68999011005",
      address: "Av. Getúlio Vargas, 320",
    },
    {
      name: "Juliana Lima",
      email: "juliana.lima@email.com",
      phone: "68999011006",
      address: "Rua Central, 55",
    },
    {
      name: "Rafael Alves",
      email: "rafael.alves@email.com",
      phone: "68999011007",
      address: "Rua da Paz, 180",
    },
    {
      name: "Fernanda Rocha",
      email: "fernanda.rocha@email.com",
      phone: "68999011008",
      address: "Av. Ceará, 720",
    },
    {
      name: "Lucas Martins",
      email: "lucas.martins@email.com",
      phone: "68999011009",
      address: "Rua Palmeiras, 95",
    },
    {
      name: "Camila Ferreira",
      email: "camila.ferreira@email.com",
      phone: "68999011010",
      address: "Rua Amazonas, 140",
    },
    {
      name: "Bruno Carvalho",
      email: "bruno.carvalho@email.com",
      phone: "68999011011",
      address: "Av. Nações Unidas, 300",
    },
    {
      name: "Larissa Gomes",
      email: "larissa.gomes@email.com",
      phone: "68999011012",
      address: "Rua dos Ipês, 75",
    },
    {
      name: "André Mendes",
      email: "andre.mendes@email.com",
      phone: "68999011013",
      address: "Rua Vitória, 250",
    },
    {
      name: "Patrícia Nunes",
      email: "patricia.nunes@email.com",
      phone: "68999011014",
      address: "Av. Independência, 410",
    },
    {
      name: "Diego Barbosa",
      email: "diego.barbosa@email.com",
      phone: "68999011015",
      address: "Rua Esperança, 60",
    },
    {
      name: "Beatriz Ramos",
      email: "beatriz.ramos@email.com",
      phone: "68999011016",
      address: "Rua Acre, 530",
    },
    {
      name: "Gustavo Teixeira",
      email: "gustavo.teixeira@email.com",
      phone: "68999011017",
      address: "Av. Brasil, 890",
    },
    {
      name: "Mariana Dias",
      email: "mariana.dias@email.com",
      phone: "68999011018",
      address: "Rua das Acácias, 115",
    },
    {
      name: "Thiago Castro",
      email: "thiago.castro@email.com",
      phone: "68999011019",
      address: "Rua Principal, 340",
    },
    {
      name: "Renata Moreira",
      email: "renata.moreira@email.com",
      phone: "68999011020",
      address: "Av. Ceará, 180",
    },
    {
      name: "Felipe Monteiro",
      email: "felipe.monteiro@email.com",
      phone: "68999011021",
      address: "Rua União, 420",
    },
    {
      name: "Aline Cardoso",
      email: "aline.cardoso@email.com",
      phone: "68999011022",
      address: "Rua das Palmeiras, 88",
    },
    {
      name: "Rodrigo Freitas",
      email: "rodrigo.freitas@email.com",
      phone: "68999011023",
      address: "Av. Getúlio Vargas, 610",
    },
    {
      name: "Priscila Moura",
      email: "priscila.moura@email.com",
      phone: "68999011024",
      address: "Rua do Comércio, 125",
    },
    {
      name: "Eduardo Lopes",
      email: "eduardo.lopes@email.com",
      phone: "68999011025",
      address: "Rua da Liberdade, 270",
    },
    {
      name: "Vanessa Correia",
      email: "vanessa.correia@email.com",
      phone: "68999011026",
      address: "Av. Brasil, 150",
    },
    {
      name: "Marcelo Vieira",
      email: "marcelo.vieira@email.com",
      phone: "68999011027",
      address: "Rua Central, 430",
    },
    {
      name: "Isabela Duarte",
      email: "isabela.duarte@email.com",
      phone: "68999011028",
      address: "Rua das Flores, 320",
    },
    {
      name: "Leonardo Pinto",
      email: "leonardo.pinto@email.com",
      phone: "68999011029",
      address: "Av. Ceará, 540",
    },
    {
      name: "Sabrina Araújo",
      email: "sabrina.araujo@email.com",
      phone: "68999011030",
      address: "Rua Rio Branco, 95",
    },
  ];

  const generator = new SequentialNumberGenerator({
    async getNextValue(name) {
      const range = await prisma.numberRange.upsert({
        where: { name },
        create: { name, currentValue: 1 },
        update: { currentValue: { increment: 1 } },
        select: { currentValue: true },
      });
      return range.currentValue;
    },
  });

  const data = [];
  for (const customer of customers) {
    data.push({
      ...customer,
      code: await generator.generate(NumberRangeName.CUSTOMER, "C"),
    });
  }

  await prisma.customer.createMany({ data });

  console.log("✅ 30 customers criados!");
}
