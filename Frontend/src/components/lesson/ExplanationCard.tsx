import AIHelpButton from "./AIHelpButton";

import ReadingLesson from "./ReadingLesson";



interface Props{

content:string;

onExplainAgain:()=>void;

}



const ExplanationCard = ({
content,
onExplainAgain

}:Props)=>{


return (

<div className="
bg-white
dark:bg-slate-800
rounded-xl
border
dark:border-slate-700
p-6
shadow-sm
">


<div className="
flex
justify-between
items-center
mb-5
">


<h2 className="
text-xl
font-bold
text-slate-800
dark:text-white
">


🤖 AI Teacher

</h2>



<AIHelpButton
onClick={onExplainAgain}
/>


</div>




<ReadingLesson content={content} />



</div>


)

}



export default ExplanationCard;