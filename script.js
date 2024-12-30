let menuVisible = false;
//Función que oculta o muestra el menu
function mostrarOcultarMenu(){
    if(menuVisible){
        document.getElementById("nav").classList ="";
        menuVisible = false;
    }else{
        document.getElementById("nav").classList ="responsive";
        menuVisible = true;
    }
}

function seleccionar(){
    //oculto el menu una vez que selecciono una opcion
    document.getElementById("nav").classList = "";
    menuVisible = false;
}
//Funcion que aplica las animaciones de las habilidades
function efectoHabilidades(){
    var skills = document.getElementById("skills");
    var distancia_skills = window.innerHeight - skills.getBoundingClientRect().top;
    if(distancia_skills >= 300){
        let habilidades = document.getElementsByClassName("progreso");
        habilidades[0].classList.add("angular");
        habilidades[1].classList.add("typescript");
        habilidades[2].classList.add("javascript");
        habilidades[3].classList.add("htmlcss");
        habilidades[4].classList.add("frameworks");
        habilidades[5].classList.add("git");
        habilidades[6].classList.add("figma");
        habilidades[7].classList.add("databases");
        habilidades[8].classList.add("backend");
        habilidades[9].classList.add("aws");
        habilidades[10].classList.add("python");
        habilidades[11].classList.add("español");
        habilidades[12].classList.add("ingles");
        habilidades[13].classList.add("responsable");
        habilidades[14].classList.add("creatividad");
        habilidades[15].classList.add("trabajoEquipo");
        habilidades[16].classList.add("autodidacta");
    }
}


//detecto el scrolling para aplicar la animacion de la barra de habilidades
window.onscroll = function(){
    efectoHabilidades();
} 
