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
        return res.status(400).json({ error: "Parâmetros incompletos." });
    }

    // Código EXATO baseado no seu último print oficial da API
    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel.p.rapidapi.com/v1/flights/search-one-way',
        params: { 
            fromEntityId: origemId, 
            toEntityId: destinoId, 
            departDate: data
        },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        
        // Log de segurança: se a API responder diferente, nós veremos aqui
        console.log("Sucesso na API! Estrutura recebida:", JSON.stringify(response.data).substring(0, 300) + "...");
        
        const flights = response.data.data || [];

        const processed = flights.slice(0, 5).map(f => {
            const aero = f?.legs?.[0]?.origin?.displayCode || f?.legs?.[0]?.origin?.id || origemId;
            const logistica = regionalCosts[aero] || { bus: 0, company: "Indefinido" };
            const flightPrice = Math.round(f?.price?.raw || f?.price || 0);
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
