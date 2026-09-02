import {
FaBookOpen,
FaChevronDown,
FaChevronRight,
FaAtom,
FaFlask,
FaCalculator
} from "react-icons/fa";


import {
useState
} from "react";


import {
motion
} from "framer-motion";


import {
curriculum
} from "../../data/curriculum";


import {
useNavigate,
useParams
} from "react-router-dom";



const Sidebar = ()=>{


const [openForm,setOpenForm]
=
useState("form1");


const [openSubject,setOpenSubject]
=
useState<string|null>(null);



const navigate = useNavigate();


const {
topic
}=useParams();



return (

<aside
className="
fixed
inset-y-0
left-0
w-72
bg-white
dark:bg-slate-800
border-r
border-slate-200
dark:border-slate-700
h-screen
overflow-y-auto
p-5
"
>


<div className="
flex
items-center
gap-3
mb-8
">

<button
onClick={()=>navigate("/")}
className="
flex
items-center
gap-3
"
>


<div className="
bg-sky-500
text-white
p-3
rounded-xl
">

<FaBookOpen/>

</div>


<h1 className="
font-bold
text-xl
">
EduMentor AI
</h1>

</button>

</div>



<h3 className="
text-xs
font-bold
text-slate-400
mb-3
">
CURRICULUM
</h3>



{
curriculum.map(form=>(


<div key={form.id}>


<button

onClick={()=>
setOpenForm(
openForm===form.id
?
""
:
form.id
)
}


className="
flex
justify-between
items-center
w-full
p-3
rounded-lg
hover:bg-sky-50
dark:text-slate-200
dark:hover:bg-slate-700
"
>


<span>
{form.name}
</span>


{
openForm===form.id
?
<FaChevronDown/>
:
<FaChevronRight/>
}


</button>




{
openForm===form.id &&

<motion.div

initial={{
opacity:0,
height:0
}}

animate={{
opacity:1,
height:"auto"
}}

className="
ml-3
"
>


{
form.subjects.map(subject=>(


<div key={subject.id}>


<button

onClick={()=>

setOpenSubject(
openSubject===subject.id
?
null
:
subject.id
)

}


className="
flex
items-center
gap-3
w-full
p-2
rounded-lg
hover:bg-sky-50
dark:hover:bg-slate-700
text-slate-700
dark:text-slate-300
"
>


{
subject.id==="mathematics"
&&
<FaCalculator className="text-sky-500"/>
}


{
subject.id==="physics"
&&
<FaAtom className="text-sky-500"/>
}


{
subject.id==="chemistry"
&&
<FaFlask className="text-sky-500"/>
}



{
subject.name
}



</button>




{
openSubject===subject.id &&


<motion.div

initial={{
opacity:0,
x:-10
}}

animate={{
opacity:1,
x:0
}}

className="
ml-8
space-y-1
"
>


{
subject.topics.map(item=>(


<button


key={item}


onClick={()=>

navigate(
`/lesson/${item}?subject=${subject.id}&form=${form.name}`
)

}



className={`
w-full
text-left
p-2
rounded-md
text-sm

${
topic===item

?

"bg-sky-500 text-white"

:

"text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-slate-700"

}
`}


>


{item}


</button>


))

}


</motion.div>


}



</div>


))

}


</motion.div>


}


</div>


))

}



</aside>

)

}


export default Sidebar;