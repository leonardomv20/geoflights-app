const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Configuração de custo fixo de ônibus (Lógica de Mochileiro)
const regionalCosts = {
    "GRU": { name: "Guarulhos", bus: 150, company: "Cometa" },
    "VCP": { name: "Viracopos", bus: 95, company: "VB Transportes" },
    "RAO": { name: "Ribeirão", bus: 45, company: "Uber/Local" }
};

app.get('/api/buscar', async (req, res) => {
    const { origemId, destinoId, data } = req.query;
    
    // A chave será lida de forma segura pelo servidor (Passo 2)
    const apiKey = process.env.RAPIDAPI_KEY; 

    const options = {
        method: 'GET',
        url: 'https://skyscanner-flights-travel.p.rapidapi.com/v1/flights/search-one-way',
        params: { fromEntityId: origemId, toEntityId: destinoId, departDate: data },
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skyscanner-flights-travel.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        const flights = response.data.data || [];

        const processed = flights.slice(0, 5).map(f => {
            const aero = f.legs[0].origin.displayCode;
            const logistica = regionalCosts[aero] || { bus: 0, company: "N/A" };
            const flightPrice = Math.round(f.price.raw);

            return {
                aero: aero,
                cia: f.legs[0].carriers.marketing[0].name,
                precoVoo: flightPrice,
                custoBus: logistica.bus,
                total: flightPrice + logistica.bus,
                transporte: logistica.company
            };
        });

        res.json(processed);
    } catch (error) {
        res.status(500).json({ error: "Erro na API do Skyscanner" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));