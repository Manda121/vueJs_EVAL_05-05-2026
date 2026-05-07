<script>
    import {ref} from 'vue';
    import {XMLParser} from 'fast-xml-parser';

    const newcustomer = ref({
        lastname: '',
        firstname: '',
        email: '',
        password: '',
        id_default_group: '',
        active: 0
    });
</script>