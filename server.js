const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Proteção: Apenas o seu site pode usar este servidor, evitando que outros gastem sua cota do RapidAPI
const corsOptions = {
    origin: ['https://leonardomv20.github.io', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Custos logísticos hardcoded para o MVP
const regionalCosts = {
    "GRU": { name: "Guarulhos", bus: 150, company: "Cometa" },
    "VCP": { name: "Viracopos", bus: 95, company: "VB Transportes" },
    "RAO": { name: "Ribeirão Preto", bus: 45, company: "Uber/Local" }
};

app.get('/api/buscar', async (req, res) => {
    const { origemId, destinoId, data } = req.query;
    const apiKey = process.env.RAPIDAPI_KEY; 

    if (!origemId || !destinoId || !data) {
        return res.status(400).json({ error: "Parâmetros incompletos. Necessário origemId, destinoId e data." });
    }

    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel.p.rapidapi.com/v1/flights/search-one-way',
        params: { 
            fromEntityId: origemId, 
            toEntityId: destinoId, 
            departDate: data,
            currency: 'BRL', // Força o preço em Reais
            market: 'BR',    // Mercado brasileiro
            locale: 'pt-BR'  // Idioma português
        },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        const flights = response.data.data || [];

        const processed = flights.slice(0, 5).map(f => {
            // "Optional Chaining" (?.) - Impede o app de quebrar se o Skyscanner não mandar algum dado
            const aero = f?.legs?.[0]?.origin?.displayCode || origemId;
            const logistica = regionalCosts[aero] || { bus: 0, company: "Indefinido" };
            const flightPrice = Math.round(f?.price?.raw || 0);
            const carrier = f?.legs?.[0]?.carriers?.marketing?.[0]?.name || "Cia Aérea Desconhecida";

            return {
                aero: aero,
                cia: carrier,
                precoVoo: flightPrice,
                custoBus: logistica.bus,
                total: flightPrice + logistica.bus,
                transporte: logistica.company
            };
        });

        res.json(processed);
    } catch (error) {
        console.error("Erro na API:", error.response?.data || error.message);
        res.status(500).json({ error: "Erro ao consultar a malha aérea." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
