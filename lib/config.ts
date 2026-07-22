/**
 * Şu an panel tek organizasyon için yapılandırılmış.
 * Backend'de çoklu organizasyon/tenant desteği eklendiğinde
 * bu sabit, bir API çağrısına (örn. /api/v1/organizations) dönüştürülebilir.
 */
export const DEFAULT_ORGANIZATION = {
    name: "İzmir Büyükşehir Belediyesi",
    domain: "izmir.bel.tr",
};
