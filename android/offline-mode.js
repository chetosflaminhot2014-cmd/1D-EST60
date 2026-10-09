/* Respaldo de datos para la app Android. La web original no se modifica. */
(function () {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const key = "est60-cache:" + url;
        try {
            const response = await originalFetch(input, init);
            if (response && response.ok) {
                try {
                    const clone = response.clone();
                    const text = await clone.text();
                    localStorage.setItem(key, text);
                } catch (_) {}
            }
            return response;
        } catch (error) {
            const cached = localStorage.getItem(key);
            if (cached !== null) {
                return new Response(cached, {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }
            return new Response("[]", {
                status: 200,
                headers: { "Content-Type": "application/json; charset=utf-8" }
            });
        }
    };
})();
