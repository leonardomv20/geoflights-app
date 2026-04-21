const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: ['https://leonardomv20.github.io', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const regionalCosts = {
    "GRU": { name: "Guarulhos", bus: 150, company: "Cometa" },
    "VCP": { name: "Viracopos", bus: 95, company: "VB Transportes" },
    "RAO": { name: "Ribeirão Preto", bus: 45, company: "Uber/Local" }
};

// FUNÇÃO DETETIVE BLINDADA E EM INGLÊS
async function getAirportDetails(iata, apiKey) {
    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/flights/searchAirport',
        params: { 
            query: iata,
            market: 'US',    // Voltamos para US para não bugar a API gratuita
            locale: 'en-US'  // Voltamos para Inglês
        },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel-api.p.rapidapi.com'
        }
    };
    
    try {
        const response = await axios.request(options);
        const data = response.data.data;
        
        // Super Log para vermos o que a API está devolvendo de verdade
        console.log(`Resposta do Detetive para ${iata}:`, JSON.stringify(data).substring(0, 150) + "...");
        
        if (!data || data.length === 0) {
            throw new Error(`Skyscanner retornou vazio para a sigla: ${iata}`);
        }
        
        return {
            skyId: data[0].skyId || data[0].navigation?.relevantFlightParams?.skyId,
            entityId: data[0].entityId || data[0].navigation?.relevantFlightParams?.entityId
        };
    } catch (err) {
        console.error(`Erro ao traduzir o aeroporto ${iata}:`, err.message);
        throw new Error(`Falha ao buscar código do aeroporto ${iata}`);
    }
}

app.get('/api/buscar', async (req, res) => {
    const { origemId, destinoId, data } = req.query;
    const apiKey = process.env.RAPIDAPI_KEY; 

    if (!origemId || !destinoId || !data) {
        return res.status(400).json({ error: "Parâmetros incompletos." });
    }

    try {
        console.log(`Buscando códigos secretos para ${origemId} e ${destinoId}...`);
        
        // Passo 1: Pega os IDs numéricos (agora pesquisando em US)
        const originInfo = await getAirportDetails(origemId, apiKey);
        const destInfo = await getAirportDetails(destinoId, apiKey);

        // Passo 2: Busca os voos reais (Mantemos BRL para o preço vir em Reais)
        const options = {
            method: 'GET',
            url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/flights/searchFlights',
            params: { 
                originSkyId: originInfo.skyId,      
                originEntityId: originInfo.entityId, 
                destinationSkyId: destInfo.skyId, 
                destinationEntityId: destInfo.entityId,
                date: data,                 
                adults: '1',                
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

        const response = await axios.request(options);
        
        console.log("Sucesso na busca de voos! Processando...");
        
        const flights = response.data.data?.itineraries || response.data.data?.flights || response.data.data || response.data.itineraries || [];

        const processed = flights.slice(0, 5).map(f => {
            const aero = origemId; 
            const logistica = regionalCosts[aero] || { bus: 0, company: "Indefinido" };
            const flightPrice = Math.round(f?.price?.raw || f?.price || 0);
            const carrier = f?.legs?.[0]?.carriers?.marketing?.[0]?.name || f?.legs?.[0]?.carriers?.[0]?.name || "Cia Aérea";

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
        console.error("Erro Final no Servidor:", error.response?.data || error.message);
        res.status(500).json({ error: error.message || "Erro ao consultar a malha aérea." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
