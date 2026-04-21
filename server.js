const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Proteção do seu servidor
const corsOptions = {
    origin: ['https://leonardomv20.github.io', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Custos logísticos do MVP (Mochileiro)
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

    // Código EXATO construído a partir do snippet da RapidAPI
    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/flights/searchFlights',
        params: { 
            originSkyId: origemId,      // Usando o código IATA (Ex: GRU)
            destinationSkyId: destinoId, // Usando o código IATA (Ex: PRG)
            date: data,                 // Nova nomenclatura de data
            adults: '1',                // A API exige saber quantos adultos
            cabinClass: 'economy',
            currency: 'BRL',
            market: 'BR',
            countryCode: 'BR'
        },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel-api.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        
        // Mantemos o Log para garantir a estrutura
        console.log("Sucesso na API! Estrutura recebida:", JSON.stringify(response.data).substring(0, 300) + "...");
        
        // Extrai os voos da estrutura de dados da API
        const flights = response.data.data?.itineraries || response.data.data?.flights || response.data.data || response.data.itineraries || [];

        const processed = flights.slice(0, 5).map(f => {
            const aero = f?.legs?.[0]?.origin?.displayCode || f?.legs?.[0]?.origin?.id || origemId;
            const logistica = regionalCosts[aero] || { bus: 0, company: "Indefinido" };
            const flightPrice = Math.round(f?.price?.raw || f?.price || 0);
            const carrier = f?.legs?.[0]?.carriers?.marketing?.[0]?.name || f?.legs?.[0]?.carriers?.[0]?.name || "Cia Aérea Desconhecida";

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
