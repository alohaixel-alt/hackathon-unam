import re
import sys
from pathlib import Path

import boto3
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backend.main as main


client = TestClient(main.app)


def test_health_y_frontend():
    assert client.get("/health").json() == {"status": "ok"}
    inicio = client.get("/")
    assert inicio.status_code == 200
    assert "text/html" in inicio.headers["content-type"]
    assert 'id="root"' in inicio.text


def test_frontend_y_api_funcionan_en_subruta():
    inicio = client.get("/evento/equipo/")
    assert inicio.status_code == 200
    asset = re.search(r'\./([^"\']+\.js)', inicio.text)
    assert asset
    js = client.get(f"/evento/equipo/{asset.group(1)}")
    assert js.status_code == 200
    assert "javascript" in js.headers["content-type"]
    api = client.get("/evento/equipo/api/explorar")
    assert api.status_code == 200
    assert api.json()["partidos"]["total"] == 122


def test_clima_separa_interior_y_temperatura_desconocida():
    datos = client.get("/api/explorar").json()
    assert datos["partidos"] == {
        "total": 122,
        "conTemperatura": 82,
        "interior": 33,
        "sinTemperatura": 7,
        "tempMin": 39.0,
        "tempMax": 89.0,
    }
    clima = {fila["clima"]: fila for fila in datos["clima3erCuarto"]}
    assert clima["Interior (domo o techo cerrado)"]["jugadas"] == 503
    assert clima["Temperatura no disponible"]["jugadas"] == 97
    assert sum(fila["jugadas"] for fila in clima.values()) == 1837
    assert all(fila["margen"] is not None for fila in clima.values())


def test_plan_usa_escenario_y_reporta_duda_por_partido():
    respuesta = client.get("/api/plan", params={"down": "3", "distancia": "larga", "cuarto": "todos"})
    assert respuesta.status_code == 200
    plan = respuesta.json()
    assert plan["jugadas"] == 1224
    assert [fila["jugadas"] for fila in plan["presion"]] == [607, 617]
    assert all(fila["margen"] is not None for fila in plan["presion"])
    assert client.get("/api/plan", params={"down": "9"}).status_code == 422


def test_velocidad_documenta_muestra_e_incertidumbre():
    datos = client.get("/api/velocidad").json()
    assert datos["partidos"] == 122
    assert datos["jugadas"] == 8434
    assert "122 partidos" in datos["muestra"]
    assert all(fila["margenRush"] is not None for fila in datos["porClima"])


def test_reproduccion_es_una_jugada_real_y_completa():
    respuesta = client.get("/api/replay")
    assert respuesta.status_code == 200
    jugada = respuesta.json()
    assert jugada["ataque"] == "BUF"
    assert jugada["defensa"] == "MIA"
    assert len(jugada["frames"]) == 50
    assert any(frame["evento"] == "qb_sack" for frame in jugada["frames"])


def test_limite_de_preguntas_evitar_consumo_accidental():
    ip = "prueba-limite"
    main._peticiones_ia.pop(ip, None)
    assert all(main._permitir_pregunta(ip) for _ in range(8))
    assert main._permitir_pregunta(ip) is False


def test_respuesta_de_ia_rechaza_causas_y_texto_largo():
    assert main._respuesta_es_segura("La presión fue mayor. Es una comparación.") is True
    assert main._respuesta_es_segura("El calor ayudó al equipo.") is False
    assert main._respuesta_es_segura("Una. Dos. Tres. Cuatro. Cinco.") is False


def test_nova_tiene_respuesta_alternativa(monkeypatch):
    def falla(*args, **kwargs):
        raise RuntimeError("Bedrock no disponible")

    monkeypatch.setattr(boto3, "client", falla)
    main._cache_narracion = None
    respuesta = client.get("/api/narracion")
    assert respuesta.status_code == 200
    assert respuesta.json()["ia"] is False
    assert "2021" in respuesta.json()["texto"]
    pregunta = client.post("/api/preguntar", json={"pregunta": "¿Qué sabemos del clima?"})
    assert pregunta.status_code == 200
    assert pregunta.json()["ia"] is False
    assert "No encontramos una diferencia clara" in pregunta.json()["respuesta"]
