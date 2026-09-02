import {
FaLightbulb
} from "react-icons/fa";


interface Props{

onClick:()=>void;

}


const AIHelpButton=({
onClick
}:Props)=>{


return (

<button

onClick={onClick}

className="
flex
items-center
gap-2
bg-sky-100
text-sky-700
px-4
py-2
rounded-lg
hover:bg-sky-200
"

>


<FaLightbulb/>

Explain Again


</button>

)

}


export default AIHelpButton;