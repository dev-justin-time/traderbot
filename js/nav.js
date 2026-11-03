/* lightweight nav script: highlights active link (redundant when server serves .active but keeps state) */
const links = document.querySelectorAll('.topbar .links a');
links.forEach(a=>{
  if(a.href === location.href || a.href === location.pathname.split('/').pop()){
    a.classList.add('active');
  }
});
export {};