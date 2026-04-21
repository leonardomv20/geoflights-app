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

// NOVO: Dicionário Tradutor (O Segredo do MVP)
// Ele converte a sigla para o nome da cidade em inglês para a API não bugar
const dicionarioCidades = {
    "GRU": "Sao Paulo",
    "VCP": "Campinas",
    "RAO": "Ribeirao Preto",
    "PRG": "Prague",
    "CDG": "Paris",
    "JFK": "New York",
    "MIA": "Miami",
    "EZE": "Buenos Aires"
};

// FUNÇÃO DETETIVE BLINDADA
async function getAirportDetails(iata, apiKey) {
    // Se a sigla estiver no dicionário, traduz. Se não, usa a sigla mesmo (fallback).
    const termoBusca = dicionarioCidades[iata.toUpperCase()] || iata;

    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/flights/searchAirport',
        params: { 
            query: termoBusca, // Agora o servidor pesquisa "Sao Paulo" ao invés de "GRU"
            market: 'US',    
            locale: 'en-US'  
        },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel-api.p.rapidapi.com'
        }
    };
    
    try {
        const response = await axios.request(options);
        const data = response.data.data;
        
        console.log(`Resposta Detetive para '${termoBusca}':`, JSON.stringify(data).substring(0, 100) + "...");
        
        if (!data || data.length === 0) {
            throw new Error(`A API não achou nenhuma cidade para: ${termoBusca}`);
        }
        
        // Retorna o código secreto da cidade/aeroporto
        return {
            skyId: data[0].skyId || data[0].navigation?.relevantFlightParams?.skyId,
            entityId: data[0].entityId || data[0].navigation?.relevantFlightParams?.entityId
        };
    } catch (err) {
        console.error(`Erro no Detetive:`, err.message);
        // Devolvemos um erro claro para a tela do usuário
        throw new Error(`Não foi possível achar o destino. Tente escrever o NOME DA CIDADE (ex: Prague) ao invés da sigla.`);
    }
}

app.get('/api/buscar', async (req, res) => {
    const { origemId, destinoId, data } = req.query;
    const apiKey = process.env.RAPIDAPI_KEY; 

    if (!origemId || !destinoId || !data) {
        return res.status(400).json({ error: "Parâmetros incompletos." });
    }

    try {
        console.log(`Iniciando busca: ${origemId} -> ${destinoId}...`);
        
        // Passo 1: O Detetive traduz a cidade e pega os IDs numéricos
        const originInfo = await getAirportDetails(origemId, apiKey);
        const destInfo = await getAirportDetails(destinoId, apiKey);

        // Passo 2: Busca os voos reais (Preços em Reais)
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
            const logistica = regionalCosts[aero] || { bus: 0, company: "Bus Local" };
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
