document.addEventListener("DOMContentLoaded", () => {


    /* =========================
       FECHA DE ACTUALIZACIÓN
    ========================= */

    const lastUpdate =
        document.getElementById("lastUpdate");

    if (lastUpdate) {

        const today = new Date();

        lastUpdate.textContent =
            today.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });

    }


    /* =========================
       MENÚ MÓVIL
    ========================= */

    const menuButton =
        document.getElementById("menuButton");

    const nav =
        document.getElementById("nav");

    if (menuButton && nav) {

        menuButton.addEventListener("click", () => {

            nav.classList.toggle("open");

            if (nav.classList.contains("open")) {

                menuButton.textContent = "✕";

            } else {

                menuButton.textContent = "☰";

            }

        });


        const navLinks =
            nav.querySelectorAll("a");

        navLinks.forEach(link => {

            link.addEventListener("click", () => {

                nav.classList.remove("open");

                menuButton.textContent = "☰";

            });

        });

    }


    /* =========================
       BOTÓN VOLVER ARRIBA
    ========================= */

    const backToTop =
        document.getElementById("backToTop");

    if (backToTop) {

        window.addEventListener("scroll", () => {

            if (window.scrollY > 500) {

                backToTop.classList.add("show");

            } else {

                backToTop.classList.remove("show");

            }

        });


        backToTop.addEventListener("click", () => {

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        });

    }


    /* =========================
       ANIMACIONES AL APARECER
    ========================= */

    const sections =
        document.querySelectorAll(".section");

    if ("IntersectionObserver" in window) {

        const observer =
            new IntersectionObserver(
                entries => {

                    entries.forEach(entry => {

                        if (entry.isIntersecting) {

                            entry.target.classList.add(
                                "visible"
                            );

                        }

                    });

                },
                {
                    threshold: 0.08
                }
            );


        sections.forEach(section => {

            observer.observe(section);

        });

    }


    /* =========================
       ACCESO AL MENÚ DE PROGRAMADOR
    ========================= */

    const programmerLogin =
        document.getElementById(
            "programmerLogin"
        );

    if (programmerLogin) {

        programmerLogin.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                const password =
                    document.getElementById(
                        "programmerPassword"
                    ).value;


                const error =
                    document.getElementById(
                        "loginError"
                    );


                if (password === "linces20261D") {

                    error.textContent = "";

                    window.location.href =
                        "programador.html";

                } else {

                    error.textContent =
                        "Contraseña incorrecta.";

                }

            }
        );

    }


    /* =========================
       MENSAJE DE INICIO
    ========================= */

    console.log(
        "1°D Web V2 iniciada correctamente."
    );

});