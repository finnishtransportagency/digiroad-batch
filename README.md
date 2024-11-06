# Digiroad-batch

Repositorio sisältää AWS cdk:lla toteutetut digiroad-eräajot sekä cicd-koodin, joka päivittää eräajostackeja.

## Asennus

Varmista, että seuraavat ohjelmistot on asennettu:
- [Node.js](https://nodejs.org/) (v20 käytössä)
- [AWS CLI](https://aws.amazon.com/cli/) (konfiguroituna AWS-tilillesi)
- [AWS CDK](https://aws.amazon.com/cdk/) (asennettuna globaalisti)

Eri kokonaisuuksilla on oma cdk-projektinsa ja jokaisen projektin node-paketit asennetaan ajamalla `npm install`.

## CICD

CICD:n seuraamat haarat ja niihin liitetyt ympäristöt on määritelty `cicd/bin/cicd.ts`. Projektit, joille pipeline luodaan on määritelty `cicd/lib/cicd-stack.ts`. Pipeline(t) päivitetään manuaalisesti kirjautumalla sso:lla tiliin, jonka stackia päivität `aws sso login --profile <profiili>` ja ajamalla komentoriviltä cicd-projektin juuressa:

```npx cdk deploy --profile <profiili> --context branch=<haara, jota pipeline seuraa>```

## Velho-integration

Velho-integraatiokoodi päivittää stackeja automaattisesti, kun development, test tai master-haaran koodia päivitetään. Dev-stackia saa integraatiokoodin testailua varten päivittää sso:lla oikeaan tiliin kirjautuneena myös komentoriviltä:

```npx cdk deploy --profile <profiili> --context env=dev```

## Ongelmanratkaisua

Deployn tulisi saada oikeat ympäristötiedot kontekstista ja sso-kirjautumisen tilitiedoista. Joskus voi tulla virheviesti puuttuvista credentialseista, vaikka kirjautuminen olisi ok. Ongelman voi kokeilla ratkaista tyhjentämällä sso-loginin välimuistitiedot `.aws\sso\cache\*.json` ja kirjautumalla uudelleen.